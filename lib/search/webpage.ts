import dns from "node:dns/promises";
import net from "node:net";

export type WebpageReadResponse = {
  content: string;
  costTime: number;
  description?: string;
  favicon?: string;
  siteName?: string;
  title: string;
  url: string;
};

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const TAVILY_EXTRACT_ENDPOINT = "https://api.tavily.com/extract";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_CONTENT_CHARS = 18_000;
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
    normalized.startsWith("fe80:")
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

  const hostname = url.hostname.toLowerCase();
  if (!hostname || PRIVATE_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
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

const looksLikeBlockedPage = (content: string, title?: string) => {
  const text = `${title || ""}\n${content}`.toLowerCase();
  return [
    "captcha",
    "安全验证",
    "请您登录",
    "请登录",
    "login required",
    "verify you are human",
    "access denied",
    "forbidden",
  ].some((keyword) => text.includes(keyword.toLowerCase()));
};

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
      costTime: Date.now() - startedAt,
      title: parsed.title,
      url: parsed.url,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortRequest);
  }
};

const getProviderErrorMessage = async (response: Response, fallback: string) => {
  const detail = await response.text().catch(() => "");
  if (!detail) return fallback;

  try {
    const parsed = JSON.parse(detail);
    const message =
      parsed?.error ||
      parsed?.message ||
      parsed?.detail?.error ||
      parsed?.detail ||
      parsed?.warning;
    if (typeof message === "string" && message.trim()) return message;
  } catch {
    // Use raw text below.
  }

  return detail.slice(0, 500);
};

const withTimeoutSignal = (signal: AbortSignal | undefined, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortRequest = () => controller.abort();
  signal?.addEventListener("abort", abortRequest, { once: true });

  return {
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortRequest);
    },
    signal: controller.signal,
  };
};

const readViaFirecrawl = async (url: URL, startedAt: number, signal?: AbortSignal) => {
  const apiKeys = getEnvKeys("FIRECRAWL_API_KEY");
  if (apiKeys.length === 0) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  let lastError = "Firecrawl scrape failed";

  for (const apiKey of apiKeys) {
    const timeoutSignal = withTimeoutSignal(signal, 70_000);

    try {
      const response = await fetch(FIRECRAWL_ENDPOINT, {
        body: JSON.stringify({
          blockAds: true,
          formats: ["markdown"],
          onlyCleanContent: true,
          onlyMainContent: true,
          proxy: "auto",
          removeBase64Images: true,
          storeInCache: true,
          timeout: 60_000,
          url: url.toString(),
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: timeoutSignal.signal,
      });

      if (!response.ok) {
        lastError = await getProviderErrorMessage(response, `Firecrawl HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data?.success === false) {
        lastError = data?.error || data?.warning || "Firecrawl scrape failed";
        continue;
      }

      const page = data?.data || {};
      const metadata = page.metadata || {};
      const content = normalizeWhitespace(
        String(page.markdown || page.text || page.html || ""),
      ).slice(0, MAX_CONTENT_CHARS);
      const title = normalizeWhitespace(
        String(metadata.title || page.title || metadata.ogTitle || url.hostname),
      );
      const pageUrl = String(metadata.sourceURL || metadata.url || page.url || url.toString());

      if (!content || looksLikeBlockedPage(content, title)) {
        lastError = "Firecrawl 未能获取可读正文，可能需要登录或验证码";
        continue;
      }

      return {
        content,
        costTime: Date.now() - startedAt,
        description: metadata.description || metadata.ogDescription,
        favicon: metadata.favicon,
        siteName: metadata.ogSiteName || metadata.siteName,
        title,
        url: pageUrl,
      } satisfies WebpageReadResponse;
    } finally {
      timeoutSignal.cleanup();
    }
  }

  throw new Error(lastError);
};

const readViaTavilyExtract = async (url: URL, startedAt: number, signal?: AbortSignal) => {
  const apiKeys = getEnvKeys("TAVILY_API_KEY");
  if (apiKeys.length === 0) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  let lastError = "Tavily extract failed";

  for (const apiKey of apiKeys) {
    const timeoutSignal = withTimeoutSignal(signal, 45_000);

    try {
      const response = await fetch(TAVILY_EXTRACT_ENDPOINT, {
        body: JSON.stringify({
          extract_depth: "advanced",
          format: "markdown",
          include_favicon: true,
          include_images: false,
          timeout: 30,
          urls: url.toString(),
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: timeoutSignal.signal,
      });

      if (!response.ok) {
        lastError = await getProviderErrorMessage(
          response,
          `Tavily Extract HTTP ${response.status}`,
        );
        continue;
      }

      const data = await response.json();
      const result = Array.isArray(data?.results) ? data.results[0] : undefined;
      const failed = Array.isArray(data?.failed_results) ? data.failed_results[0] : undefined;
      const content = normalizeWhitespace(
        String(result?.raw_content || result?.content || ""),
      ).slice(0, MAX_CONTENT_CHARS);
      const pageUrl = String(result?.url || url.toString());
      const title = normalizeWhitespace(String(result?.title || url.hostname));

      if (!content || looksLikeBlockedPage(content, title)) {
        lastError = failed?.error || "Tavily Extract 未能获取可读正文";
        continue;
      }

      return {
        content,
        costTime: Date.now() - startedAt,
        favicon: result?.favicon,
        title,
        url: pageUrl,
      } satisfies WebpageReadResponse;
    } finally {
      timeoutSignal.cleanup();
    }
  }

  throw new Error(lastError);
};

export async function readWebpage({
  signal,
  url,
}: {
  signal?: AbortSignal;
  url: string;
}): Promise<WebpageReadResponse> {
  const startedAt = Date.now();
  let currentUrl = await assertPublicHttpUrl(url.trim());

  try {
    return await readViaFirecrawl(currentUrl, startedAt, signal);
  } catch {
    // Fall back to Tavily Extract, then direct fetch/Jina reader below.
  }

  try {
    return await readViaTavilyExtract(currentUrl, startedAt, signal);
  } catch {
    // Fall back to direct fetch/Jina reader below.
  }

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
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
        currentUrl = await assertPublicHttpUrl(new URL(location, currentUrl).toString());
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
      const content = stripHtmlToText(html).slice(0, MAX_CONTENT_CHARS);

      if (!content || looksLikeBlockedPage(content, title)) {
        throw new Error("未能从网页中提取可读正文");
      }

      return {
        content,
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
