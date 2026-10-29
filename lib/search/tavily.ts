import { fetchRetrievalJson, retrievalSignal } from "./retrieval";
import type { WebSearchResult } from "@/lib/chat/types";
import { normalizeWebImages, publicResourceUrl, type WebImageCandidate } from "./web-assets";

type TavilyResult = {
  content?: string;
  favicon?: string;
  published_date?: string;
  raw_content?: string;
  score?: number;
  title?: string;
  url?: string;
};

export type TavilySearchResponse = {
  answer?: string;
  costTime: number;
  query: string;
  resultNumbers: number;
  results: WebSearchResult[];
  images?: WebImageCandidate[];
};

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS = 8;
const REQUEST_TIMEOUT_MS = 20_000;

const getApiKeys = () =>
  (process.env.TAVILY_API_KEY || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

export type SearchOptions = {
  maxResults?: unknown;
  searchDepth?: unknown;
  topic?: unknown;
  timeRange?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  includeDomains?: unknown;
  excludeDomains?: unknown;
  includeDomainsMode?: unknown;
  chunksPerSource?: unknown;
  filterByPublishedDate?: unknown;
};

const invalid = (field: string): never => {
  throw Object.assign(new Error(`搜索参数 ${field} 无效，请调整后重试`), { status: 400 });
};
const choice = (value: unknown, values: string[], fallback: string, field: string) =>
  value === undefined
    ? fallback
    : typeof value === "string" && values.includes(value)
      ? value
      : invalid(field);
const integer = (value: unknown, fallback: number, max: number, field: string) =>
  value === undefined
    ? fallback
    : typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max
      ? value
      : invalid(field);
const date = (value: unknown, field: string) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid(field);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    return invalid(field);
  return value;
};
const domains = (value: unknown, max: number, field: string) => {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some(
      (item) =>
        typeof item !== "string" || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}$/i.test(item),
    )
  )
    return invalid(field);
  return [...new Set(value as string[])];
};

/** Curated official Tavily options; no automatic expansion or live-crawl surcharge. */
export function buildSearchBody(query: string, options: SearchOptions = {}, includeImages = false) {
  const depth = choice(
    options.searchDepth,
    ["basic", "fast", "ultra-fast", "advanced"],
    "basic",
    "search_depth",
  );
  const topic = choice(options.topic, ["general", "news", "finance"], "general", "topic");
  const timeRange =
    options.timeRange === undefined
      ? undefined
      : choice(
          options.timeRange,
          ["day", "week", "month", "year", "d", "w", "m", "y"],
          "day",
          "time_range",
        );
  const startDate = date(options.startDate, "start_date");
  const endDate = date(options.endDate, "end_date");
  if (startDate && endDate && startDate > endDate) invalid("start_date/end_date");
  const included = domains(options.includeDomains, 300, "include_domains");
  const excluded = domains(options.excludeDomains, 150, "exclude_domains");
  const domainMode =
    options.includeDomainsMode === undefined
      ? undefined
      : choice(
          options.includeDomainsMode,
          ["restrict", "prefer"],
          "restrict",
          "include_domains_mode",
        );
  if (domainMode && !included?.length) invalid("include_domains_mode");
  if (
    options.filterByPublishedDate !== undefined &&
    typeof options.filterByPublishedDate !== "boolean"
  )
    invalid("filter_by_published_date");
  const chunks = integer(options.chunksPerSource, 2, 3, "chunks_per_source");
  return {
    query,
    topic,
    search_depth: depth,
    ...(depth !== "ultra-fast" ? { chunks_per_source: chunks } : {}),
    max_results: integer(options.maxResults, DEFAULT_MAX_RESULTS, 20, "max_results"),
    time_range: timeRange,
    start_date: startDate,
    end_date: endDate,
    include_domains: included,
    exclude_domains: excluded,
    include_domains_mode: domainMode,
    include_published_date: true,
    filter_by_published_date: options.filterByPublishedDate === true,
    include_answer: false,
    include_raw_content: false,
    include_images: includeImages,
    include_image_descriptions: includeImages,
    include_favicon: true,
    safe_search: true,
  };
}

export async function searchTavily({
  query,
  signal,
  includeImages = false,
  ...options
}: SearchOptions & {
  query: string;
  signal?: AbortSignal;
  includeImages?: boolean;
}): Promise<TavilySearchResponse> {
  const apiKeys = getApiKeys();
  if (!apiKeys.length) throw new Error("联网搜索服务尚未配置 TAVILY_API_KEY");
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length > 500) invalid("query");
  const requestBody = buildSearchBody(cleanQuery, options, includeImages);
  const startedAt = Date.now();
  const operation = retrievalSignal(signal, REQUEST_TIMEOUT_MS);
  try {
    const data = await fetchRetrievalJson(TAVILY_ENDPOINT, apiKeys, requestBody, operation.signal);
    const seen = new Set<string>();
    const results: WebSearchResult[] = Array.isArray(data.results)
      ? data.results.flatMap((item: TavilyResult) => {
          const url = publicResourceUrl(item.url);
          if (!url || seen.has(url)) return [];
          seen.add(url);
          return [
            {
              content: item.content || item.raw_content || "",
              favicon: item.favicon || undefined,
              publishedDate: item.published_date || undefined,
              score: typeof item.score === "number" ? item.score : undefined,
              title: item.title || url,
              url,
            },
          ];
        })
      : [];
    return {
      images: includeImages
        ? normalizeWebImages(Array.isArray(data.images) ? data.images : [])
        : [],
      costTime: Date.now() - startedAt,
      query: cleanQuery,
      resultNumbers: results.length,
      results,
    };
  } finally {
    operation.cleanup();
  }
}
