import type { WebSearchResult } from "@/lib/chat/types";

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
};

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS = 8;
const REQUEST_TIMEOUT_MS = 20_000;

const getApiKeys = () =>
  (process.env.TAVILY_API_KEY || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

const getTavilyErrorMessage = (detail: string) => {
  try {
    const parsed = JSON.parse(detail);
    const message = parsed?.detail?.error || parsed?.error;
    if (typeof message === "string" && message.trim()) return message;
  } catch {
    // Fall back to the raw response body below.
  }

  return detail || "Tavily search failed";
};

const toPositiveInteger = (value: unknown, fallback: number) => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.floor(number), 1), 20);
};

export async function searchTavily({
  maxResults = DEFAULT_MAX_RESULTS,
  query,
  searchDepth,
  signal,
}: {
  maxResults?: unknown;
  query: string;
  searchDepth?: unknown;
  signal?: AbortSignal;
}): Promise<TavilySearchResponse> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error("Query is required");
  }

  const startedAt = Date.now();
  const requestBody = JSON.stringify({
    include_answer: true,
    include_favicon: true,
    include_raw_content: false,
    max_results: toPositiveInteger(maxResults, DEFAULT_MAX_RESULTS),
    query: cleanQuery,
    search_depth: searchDepth === "advanced" ? "advanced" : "basic",
  });

  let lastError: { detail?: string; error: string; status: number } | undefined;

  for (const apiKey of apiKeys) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const abortRequest = () => controller.abort();
    signal?.addEventListener("abort", abortRequest, { once: true });

    try {
      const response = await fetch(TAVILY_ENDPOINT, {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        lastError = {
          detail,
          error: getTavilyErrorMessage(detail),
          status: response.status,
        };
        continue;
      }

      const data = await response.json();
      const results = Array.isArray(data.results)
        ? data.results
            .map((item: TavilyResult) => ({
              content: item.content || item.raw_content || "",
              favicon: item.favicon || undefined,
              publishedDate: item.published_date || undefined,
              score: typeof item.score === "number" ? item.score : undefined,
              title: item.title || item.url || "Untitled",
              url: item.url || "",
            }))
            .filter((item: { url: string }) => item.url)
        : [];

      return {
        answer: typeof data.answer === "string" ? data.answer : undefined,
        costTime: Date.now() - startedAt,
        query: cleanQuery,
        resultNumbers: results.length,
        results,
      };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortRequest);
    }
  }

  const error = new Error(lastError?.error || "Tavily search failed") as Error & {
    detail?: string;
    status?: number;
  };
  error.detail = lastError?.detail;
  error.status = lastError?.status || 502;
  throw error;
}
