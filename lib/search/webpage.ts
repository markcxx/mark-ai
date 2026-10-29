import dns from "node:dns/promises";
import { assessWebContent, cleanWebContent } from "./content-quality";
import { fetchRetrievalJson, firstUsable, retrievalSignal } from "./retrieval";
import type { WebRetrievalDetails } from "@/lib/chat/types";
import net from "node:net";
import {
  extractWebImages,
  extractWebLinks,
  publicResourceUrl,
  normalizeWebImages,
  type WebImageCandidate,
} from "./web-assets";

export type WebpageReadResponse = {
  content: string;
  costTime: number;
  description?: string;
  favicon?: string;
  siteName?: string;
  title: string;
  url: string;
  images?: WebImageCandidate[];
  links?: string[];
  truncated?: boolean;
  retrieval?: WebRetrievalDetails;
};

export type WebpageProvider = "auto" | "tavily" | "firecrawl";

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const TAVILY_EXTRACT_ENDPOINT = "https://api.tavily.com/extract";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_CONTENT_CHARS = 240_000;
const MAX_REDIRECTS = 5;
const ACCESS_DENIED_STATUS = new Set([401, 403, 418, 429]);

const PRIVATE_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

const getEnvKeys = (name: string) =>
  (process.env[name] || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

const isPrivateIPv4 = (ip: string) => {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
};

const isPrivateIPv6 = (ip: string) => {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:")
  );
};

const isPrivateAddress = (ip: string) => {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
};

const assertPublicHttpUrl = async (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL 格式无效");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只支持 http/https 网页");
  }

  if (url.username || url.password) throw new Error("网页 URL 不能包含账号或密码");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    PRIVATE_HOSTNAMES.has(hostname) ||
    /\.(local|internal|localhost)$/.test(hostname)
  ) {
    throw new Error("不允许读取本机或内网地址");
  }

  if (net.isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error("不允许读取本机或内网地址");
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw new Error("不允许读取本机或内网地址");
  }

  return url;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const getMetaContent = (html: string, name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return normalizeWhitespace(decodeHtmlEntities(match[1]));
  }

  return undefined;
};

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\r/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const stripHtmlToText = (html: string) => {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const source = articleMatch?.[1] || mainMatch?.[1] || html;

  const text = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|header|aside|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6]|blockquote|pre|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeWhitespace(decodeHtmlEntities(text));
};

const readResponseText = async (response: Response) => {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new Error("网页内容过大，已停止读取");
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > MAX_HTML_BYTES) {
      throw new Error("网页内容过大，已停止读取");
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(buffer);
};

const looksLikeBlockedPage = (content: string, title?: string) =>
  assessWebContent(content, title).blocked;

const getReaderUrl = (url: URL) => `https://r.jina.ai/${url.toString()}`;

const parseReaderMarkdown = (markdown: string, fallbackUrl: URL) => {
  const title = markdown.match(/^Title:\s*(.+)$/im)?.[1]?.trim() || fallbackUrl.hostname;
  const source = markdown.match(/^URL Source:\s*(.+)$/im)?.[1]?.trim() || fallbackUrl.toString();
  const publishedIndex = markdown.search(/^Markdown Content:\s*$/im);
  const content =
    publishedIndex >= 0
      ? markdown.slice(publishedIndex).replace(/^Markdown Content:\s*/i, "")
      : markdown;

  return {
    content: normalizeWhitespace(content),
    title: normalizeWhitespace(title),
    url: source,
  };
};

const readViaReader = async (url: URL, startedAt: number, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortRequest = () => controller.abort();
  signal?.addEventListener("abort", abortRequest, { once: true });

  try {
    const response = await fetch(getReaderUrl(url), {
      headers: {
        Accept: "text/plain,text/markdown,*/*;q=0.2",
        "User-Agent": "Mozilla/5.0 (compatible; MarkAI-WebReader/1.0; +https://markai.local)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`reader fallback failed: HTTP ${response.status}`);
    }

    const markdown = await readResponseText(response);
    const parsed = parseReaderMarkdown(markdown, url);
    const content = parsed.content.slice(0, MAX_CONTENT_CHARS);

    if (!content || looksLikeBlockedPage(content, parsed.title)) {
      throw new Error("该网页要求登录或验证码，普通网页读取无法获取正文");
    }

    return {
      content,
      images: extractWebImages(parsed.content, url.toString()),
      links: extractWebLinks(parsed.content, url.toString()),
      truncated: parsed.content.length > MAX_CONTENT_CHARS,
      costTime: Date.now() - startedAt,
      title: parsed.title,
      url: parsed.url,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortRequest);
  }
};

const readViaFirecrawl = async (
  url: URL,
  startedAt: number,
  signal: AbortSignal,
  clean = false,
) => {
  const data = await fetchRetrievalJson(
    FIRECRAWL_ENDPOINT,
    getEnvKeys("FIRECRAWL_API_KEY"),
    {
      url: url.toString(),
      formats: ["markdown", "links"],
      onlyMainContent: true,
      onlyCleanContent: clean,
      blockAds: true,
      removeBase64Images: true,
      storeInCache: true,
      proxy: "auto",
      timeout: clean ? 10_000 : 8_000,
    },
    signal,
  );
  if (data?.success === false) throw new Error("网页服务未能提取正文");
  const page = data?.data || {};
  const metadata = page.metadata || {};
  const raw = String(page.markdown || page.text || "");
  const sourceUrl =
    publicResourceUrl(metadata.sourceURL || metadata.url || page.url) || url.toString();
  const bodyImages = extractWebImages(raw, sourceUrl);
  return {
    content: raw.slice(0, MAX_CONTENT_CHARS),
    title: String(metadata.title || page.title || metadata.ogTitle || url.hostname),
    url: sourceUrl,
    images: bodyImages.length
      ? bodyImages
      : normalizeWebImages([metadata.ogImage].filter(Boolean), sourceUrl),
    links: [
      ...new Set([
        ...extractWebLinks(raw, sourceUrl),
        ...(Array.isArray(page.links)
          ? page.links.flatMap((link: unknown) => {
              const safe = publicResourceUrl(link, sourceUrl);
              return safe ? [safe] : [];
            })
          : []),
      ]),
    ].slice(0, 50),
    truncated: raw.length > MAX_CONTENT_CHARS,
    description: metadata.description || metadata.ogDescription,
    favicon: metadata.favicon,
    siteName: metadata.ogSiteName || metadata.siteName,
    costTime: Date.now() - startedAt,
  } satisfies WebpageReadResponse;
};

const readViaTavilyExtract = async (
  url: URL,
  startedAt: number,
  signal: AbortSignal,
  advanced = false,
) => {
  const data = await fetchRetrievalJson(
    TAVILY_EXTRACT_ENDPOINT,
    getEnvKeys("TAVILY_API_KEY"),
    {
      urls: url.toString(),
      extract_depth: advanced ? "advanced" : "basic",
      format: "markdown",
      include_images: true,
      include_favicon: true,
      timeout: advanced ? 10 : 8,
    },
    signal,
  );
  const result = Array.isArray(data.results) ? data.results[0] : undefined;
  const raw = String(result?.raw_content || result?.content || "");
  return {
    content: raw.slice(0, MAX_CONTENT_CHARS),
    title: String(result?.title || raw.match(/^#\s+(.+)$/m)?.[1] || url.hostname),
    url: publicResourceUrl(result?.url) || url.toString(),
    images: extractWebImages(
      raw,
      url.toString(),
      Array.isArray(result?.images) ? result.images : [],
    ),
    links: extractWebLinks(raw, url.toString()),
    truncated: raw.length > MAX_CONTENT_CHARS,
    favicon: result?.favicon,
    costTime: Date.now() - startedAt,
  } satisfies WebpageReadResponse;
};

async function readDirect(
  currentUrl: URL,
  startedAt: number,
  signal: AbortSignal,
): Promise<WebpageReadResponse> {
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const abortRequest = () => controller.abort();
    signal?.addEventListener("abort", abortRequest, { once: true });

    try {
      const response = await fetch(currentUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.2",
          "User-Agent": "Mozilla/5.0 (compatible; MarkAI-WebReader/1.0; +https://markai.local)",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("网页重定向缺少目标地址");
        currentUrl = await firstUsable(
          () => assertPublicHttpUrl(new URL(location, currentUrl).toString()),
          undefined,
          signal,
        );
        continue;
      }

      if (!response.ok) {
        if (ACCESS_DENIED_STATUS.has(response.status)) {
          return await readViaReader(currentUrl, startedAt, signal);
        }
        throw new Error(`网页读取失败：HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        contentType &&
        !/text\/html|application\/xhtml\+xml|text\/plain|application\/xml|text\/xml/i.test(
          contentType,
        )
      ) {
        throw new Error(`不支持的内容类型：${contentType.split(";")[0]}`);
      }

      const html = await readResponseText(response);
      const title = normalizeWhitespace(
        decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""),
      );
      const description =
        getMetaContent(html, "description") || getMetaContent(html, "og:description");
      const siteName = getMetaContent(html, "og:site_name");
      const fullContent = stripHtmlToText(html);
      const content = fullContent.slice(0, MAX_CONTENT_CHARS);

      if (!content || looksLikeBlockedPage(content, title)) {
        throw new Error("未能从网页中提取可读正文");
      }

      return {
        content,
        images: extractWebImages(html, currentUrl.toString()),
        links: extractWebLinks(html, currentUrl.toString()),
        truncated: fullContent.length > MAX_CONTENT_CHARS,
        costTime: Date.now() - startedAt,
        description,
        siteName,
        title: title || currentUrl.hostname,
        url: currentUrl.toString(),
      };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortRequest);
    }
  }

  throw new Error("网页重定向次数过多");
}

export async function readWebpage({
  signal,
  url,
  provider = "auto",
}: {
  signal?: AbortSignal;
  url: string;
  provider?: WebpageProvider;
}): Promise<WebpageReadResponse> {
  if (!["auto", "tavily", "firecrawl"].includes(provider))
    throw new Error("网页读取服务无效，请选择 auto、tavily 或 firecrawl。");
  const startedAt = Date.now();
  const operation = retrievalSignal(signal, 30_000);
  const attempts: WebRetrievalDetails["attempts"] = [];
  let needsCleaning = false;
  const attempt =
    (provider: string, mode: string, run: (signal: AbortSignal) => Promise<WebpageReadResponse>) =>
    async (attemptSignal: AbortSignal) => {
      const start = Date.now();
      const trace: WebRetrievalDetails["attempts"][number] = {
        provider,
        mode,
        durationMs: 0,
        outcome: "pending",
      };
      attempts.push(trace);
      try {
        const result = await run(attemptSignal);
        attemptSignal.throwIfAborted();
        const content = cleanWebContent(result.content);
        const quality = assessWebContent(content, result.title);
        needsCleaning ||= quality.noisy;
        if (!quality.usable) {
          trace.outcome = "unusable";
          throw new Error("网页未返回可用正文，请尝试其他来源");
        }
        trace.outcome = "accepted";
        return { ...result, content, retrieval: { provider, mode, attempts: [] } };
      } catch (error) {
        if (trace.outcome === "pending")
          trace.outcome = attemptSignal.aborted ? "cancelled" : "error";
        throw error;
      } finally {
        trace.durationMs = Date.now() - start;
      }
    };
  try {
    // The DNS check itself is bounded and cancellation-aware as well.
    const currentUrl = await firstUsable(
      () => assertPublicHttpUrl(url.trim()),
      undefined,
      operation.signal,
    );
    const tavily = getEnvKeys("TAVILY_API_KEY").length > 0;
    const firecrawl = getEnvKeys("FIRECRAWL_API_KEY").length > 0;
    let result: WebpageReadResponse | undefined;
    const tryReaders = async (enhanced: boolean) => {
      const order =
        provider === "firecrawl"
          ? (["firecrawl", "tavily"] as const)
          : (["tavily", "firecrawl"] as const);
      const readers = order.flatMap((name) => {
        if (name === "firecrawl")
          return firecrawl && (!enhanced || needsCleaning)
            ? [
                attempt(name, enhanced ? "clean" : "basic", (s) =>
                  readViaFirecrawl(currentUrl, startedAt, s, enhanced),
                ),
              ]
            : [];
        return tavily
          ? [
              attempt(name, enhanced ? "advanced" : "basic", (s) =>
                readViaTavilyExtract(currentUrl, startedAt, s, enhanced),
              ),
            ]
          : [];
      });
      // Honor the selected reader; use the backup only on failure or timeout.
      for (const reader of readers) {
        operation.signal.throwIfAborted();
        const stage = retrievalSignal(operation.signal, enhanced ? 12_000 : 10_000);
        try {
          return await firstUsable(reader, undefined, stage.signal);
        } catch {
          operation.signal.throwIfAborted();
        } finally {
          stage.cleanup();
        }
      }
      return undefined;
    };
    result = await tryReaders(false);
    if (!result) result = await tryReaders(true);
    if (!result)
      result = await attempt("direct", "html", (s) => readDirect(currentUrl, startedAt, s))(
        operation.signal,
      );
    return {
      ...result,
      costTime: Date.now() - startedAt,
      retrieval: {
        ...result.retrieval!,
        requestedProvider: provider,
        attempts: attempts.map((trace) => ({
          ...trace,
          outcome: trace.outcome === "pending" ? "cancelled" : trace.outcome,
        })),
      },
    };
  } finally {
    operation.cleanup();
  }
}
