import { createHash } from "node:crypto";

import type { WebImage, WebSearchState } from "../types";
import { publicResourceUrl, type WebImageCandidate } from "../../search/web-assets";
import { searchTavily } from "../../search/tavily";
import { readWebpage, type WebpageReadResponse } from "../../search/webpage";
import type { ChatMessage } from "./types";
import { WEB_TOOLS } from "./runtime-prompt";
import { describeGenerationError } from "../generation-error";
import { normalizeWebResourceContext } from "../web-context";

export const WEB_TOOL_NAMES = new Set<string>(WEB_TOOLS.map((tool) => tool.function.name));
const MAX_EXCERPT_CHARS = 12_000;

const positiveInteger = (value: unknown, fallback: number, max: number) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? Math.min(value, max)
    : fallback;

function pageLines(content: string) {
  const lines: { text: string; offset: number }[] = [];
  let offset = 0;
  for (const line of content.split("\n")) {
    for (let index = 0; index < Math.max(1, line.length); index += 240) {
      lines.push({ text: line.slice(index, index + 240), offset: offset + index });
    }
    offset += line.length + 1;
  }
  return lines;
}

export function getPageExcerpt(document: WebpageReadResponse, start = 1, count = 80) {
  const lines = pageLines(document.content);
  const first = Math.min(positiveInteger(start, 1, lines.length), lines.length);
  const selected: string[] = [];
  let length = 0;
  for (
    let index = first - 1;
    index < Math.min(lines.length, first - 1 + positiveInteger(count, 80, 160));
    index++
  ) {
    const line = `${index + 1}: ${lines[index].text}`;
    if (length + line.length > MAX_EXCERPT_CHARS) break;
    selected.push(line);
    length += line.length + 1;
  }
  const end = first + selected.length - 1;
  return {
    content: selected.join("\n"),
    page: {
      startLine: first,
      endLine: end,
      totalLines: lines.length,
      nextLine: end < lines.length ? end + 1 : undefined,
      truncated: document.truncated || end < lines.length,
    },
  };
}

/** Per-generation registry: URLs have provenance, images are selected by ID,
 * and long documents stay out of the model context until requested. */
export class WebToolSession {
  private knownUrls = new Set<string>();
  private documents = new Map<string, WebpageReadResponse>();
  private images = new Map<string, WebImage>();
  private citations = new Map<string, number>();

  constructor(
    messages: ChatMessage[],
    private signal?: AbortSignal,
  ) {
    for (const message of messages.slice(-20)) {
      const webContext = normalizeWebResourceContext(message.webContext);
      if (message.role === "user") {
        for (const match of message.content.matchAll(/https?:\/\/[^\s<>"'\]\)。，、；！？]+/g))
          this.rememberUrl(match[0].replace(/[。，、；！？.,;!?]+$/, ""));
      }
      for (const source of webContext?.sources || []) this.rememberUrl(source.url);
      for (const image of webContext?.images || []) {
        if (typeof image.url !== "string") continue;
        this.registerImages([
          {
            ...image,
            title: typeof image.title === "string" ? image.title.slice(0, 300) : "网页图片",
          },
        ]);
        if (image.sourceUrl) this.rememberUrl(image.sourceUrl);
      }
    }
  }

  private rememberUrl(value: unknown) {
    const url = publicResourceUrl(value);
    if (url) this.knownUrls.add(url);
    return url;
  }

  private registerImages(candidates: WebImageCandidate[]) {
    return candidates.slice(0, 12).flatMap((candidate) => {
      const url = publicResourceUrl(candidate.url);
      if (!url) return [];
      const id = `img_${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
      const image = {
        ...candidate,
        url,
        id,
        sourceUrl: publicResourceUrl(candidate.sourceUrl) || this.images.get(id)?.sourceUrl,
      };
      this.images.set(id, image);
      return [image];
    });
  }

  private source(url: string, title: string, content?: string) {
    this.rememberUrl(url);
    if (!this.citations.has(url)) this.citations.set(url, this.citations.size + 1);
    return { url, title, content, citationId: this.citations.get(url)! };
  }

  private async document(raw: unknown) {
    const url = publicResourceUrl(raw);
    if (!url || !this.knownUrls.has(url))
      throw new Error("请先通过搜索、用户提供的链接或已读页面的链接定位网页，再读取该 URL。");
    let document = this.documents.get(url);
    if (!document) {
      document = await readWebpage({ url, signal: this.signal });
      // Treat the reader's final URL as source metadata, never arbitrary fetch instructions.
      document.url = publicResourceUrl(document.url) || url;
      this.rememberUrl(document.url);
      for (const link of (document.links || []).slice(0, 50)) this.rememberUrl(link);
      this.documents.set(url, document);
      this.documents.set(document.url, document);
    }
    return document;
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    callId: string,
    emit: (state: WebSearchState) => void,
  ): Promise<WebSearchState> {
    this.signal?.throwIfAborted();
    if (!WEB_TOOL_NAMES.has(name)) throw new Error("不支持的联网工具");
    const tool = name as NonNullable<WebSearchState["tool"]>;
    const query =
      typeof args.query === "string"
        ? args.query.trim()
        : typeof args.pattern === "string"
          ? args.pattern.trim()
          : typeof args.url === "string"
            ? args.url.trim()
            : "图片展示";
    const startedAt = Date.now();
    const state: WebSearchState = {
      callId,
      tool,
      query,
      results: [],
      status: "searching",
      url: publicResourceUrl(args.url),
    };
    emit(state);
    try {
      let result: WebSearchState;
      if (name === "web_search") {
        if (!query || query.length > 500) throw new Error("请输入不超过 500 个字符的搜索内容");
        const found = await searchTavily({
          query,
          includeImages: args.include_images === true,
          signal: this.signal,
        });
        result = {
          ...state,
          contentKind: "search_snippets",
          status: "done",
          results: found.results.map((item) => ({
            ...item,
            ...this.source(item.url, item.title, item.content),
          })),
          images: this.registerImages(found.images || []),
        };
      } else if (name === "show_images") {
        const ids = Array.isArray(args.image_ids) ? [...new Set(args.image_ids)] : [];
        if (
          !ids.length ||
          ids.length > 6 ||
          ids.some((id) => typeof id !== "string" || !this.images.has(id))
        )
          throw new Error("请提供 1–6 个搜索或网页读取结果中实际返回的图片 ID。");
        const images = ids.map((id) => this.images.get(id as string)!);
        result = {
          ...state,
          status: "done",
          contentKind: "image_selection",
          images,
          results: [
            ...new Map(
              images.flatMap((image) =>
                image.sourceUrl
                  ? [[image.sourceUrl, this.source(image.sourceUrl, image.title)] as const]
                  : [],
              ),
            ).values(),
          ],
        };
      } else {
        const document = await this.document(args.url);
        const base = {
          ...state,
          status: "done" as const,
          url: document.url,
          title: document.title,
          description: document.description,
          siteName: document.siteName,
          images: this.registerImages(document.images || []),
          links: document.links?.slice(0, 30),
          results: [
            {
              ...this.source(
                document.url,
                document.title,
                document.description || document.content.slice(0, 600),
              ),
              favicon: document.favicon,
            },
          ],
        };
        if (name === "read_webpage") {
          result = {
            ...base,
            contentKind: "page",
            ...getPageExcerpt(
              document,
              positiveInteger(args.start_line, 1, 100000),
              positiveInteger(args.max_lines, 80, 160),
            ),
          };
        } else {
          const pattern = typeof args.pattern === "string" ? args.pattern.trim() : "";
          if (!pattern || pattern.length > 200)
            throw new Error("请输入不超过 200 个字符的页内查找词");
          const lines = pageLines(document.content);
          const haystack = document.content.toLowerCase();
          const needle = pattern.toLowerCase();
          const matches: number[] = [];
          let position = haystack.indexOf(needle);
          while (position >= 0 && matches.length < 12) {
            const next = lines.findIndex((line) => line.offset > position);
            const line = next < 0 ? lines.length : next;
            if (!matches.includes(line)) matches.push(line);
            position = haystack.indexOf(needle, position + Math.max(1, needle.length));
          }
          const selected = new Set<number>();
          for (const line of matches)
            for (
              let index = Math.max(1, line - 2);
              index <= Math.min(lines.length, line + 3);
              index++
            )
              selected.add(index);
          result = {
            ...base,
            contentKind: "page_matches",
            content: matches.length
              ? [...selected]
                  .sort((a, b) => a - b)
                  .map((line) => `${line}: ${lines[line - 1].text}`)
                  .join("\n")
                  .slice(0, MAX_EXCERPT_CHARS)
              : "未找到该词，可换用页面中的术语，或继续阅读相邻章节。",
            page: {
              startLine: matches[0] || 1,
              endLine: matches.at(-1) || 1,
              totalLines: lines.length,
              matches,
              truncated: document.truncated,
            },
          };
        }
      }
      result.completedAt = Date.now();
      result.costTime = Date.now() - startedAt;
      emit(result);
      return result;
    } catch (error) {
      this.signal?.throwIfAborted();
      const safeError = describeGenerationError(
        error,
        [process.env.TAVILY_API_KEY || "", process.env.FIRECRAWL_API_KEY || ""].flatMap((value) =>
          value
            .split(",")
            .map((key) => key.trim())
            .filter(Boolean),
        ),
      );
      const failed: WebSearchState = {
        ...state,
        status: "error",
        completedAt: Date.now(),
        costTime: Date.now() - startedAt,
        error: /[\u4e00-\u9fff]/.test(safeError)
          ? safeError.slice(0, 400)
          : "联网工具暂时不可用，请稍后重试或更换公开来源",
      };
      emit(failed);
      return failed;
    }
  }
}
