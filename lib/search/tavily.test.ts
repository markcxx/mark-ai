import { afterEach, expect, it, vi } from "vitest";
import { buildSearchBody, searchTavily } from "./tavily";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("keeps general searches timeless and avoids expensive answer generation/raw crawling", () => {
  expect(buildSearchBody("API documentation")).toMatchObject({
    topic: "general",
    search_depth: "basic",
    chunks_per_source: 2,
    include_published_date: true,
    include_answer: false,
    include_raw_content: false,
    time_range: undefined,
  });
});

it("forwards explicit temporal, source and depth controls using official field names", () => {
  const body = buildSearchBody("events", {
    topic: "news",
    searchDepth: "advanced",
    timeRange: "day",
    startDate: "2026-10-28",
    endDate: "2026-10-29",
    includeDomains: ["example.com"],
    includeDomainsMode: "prefer",
    excludeDomains: ["spam.example.com"],
    maxResults: 15,
    chunksPerSource: 3,
    filterByPublishedDate: true,
  });
  expect(body).toMatchObject({
    topic: "news",
    search_depth: "advanced",
    time_range: "day",
    start_date: "2026-10-28",
    end_date: "2026-10-29",
    include_domains_mode: "prefer",
    max_results: 15,
    chunks_per_source: 3,
    filter_by_published_date: true,
  });
  expect(buildSearchBody("fast", { searchDepth: "ultra-fast" })).not.toHaveProperty(
    "chunks_per_source",
  );
});

it.each([
  { startDate: "2026-02-30" },
  { searchDepth: "deep" },
  { includeDomainsMode: "prefer" },
  { includeDomains: ["https://example.com/path"] },
  { chunksPerSource: 5 },
  { startDate: "2026-10-30", endDate: "2026-10-29" },
])("rejects invalid options locally: %j", (options) => {
  expect(() => buildSearchBody("query", options)).toThrow("搜索参数");
});

it("preserves dates and scores, deduplicates sources and rejects unsafe URLs", async () => {
  vi.stubEnv("TAVILY_API_KEY", "search-test-key");
  const source = {
    title: "来源",
    url: "https://example.com/article",
    content: "事实",
    published_date: "2026-10-29",
    score: 0.95,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ results: [source, source, { url: "http://localhost/private" }] }),
    ),
  );
  const result = await searchTavily({ query: "query", topic: "news" });
  expect(result.results).toEqual([
    { title: "来源", url: source.url, content: "事实", publishedDate: "2026-10-29", score: 0.95 },
  ]);
});
