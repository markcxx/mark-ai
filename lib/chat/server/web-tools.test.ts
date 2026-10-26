import { beforeEach, expect, it, vi } from "vitest";
import { WebToolSession, getPageExcerpt } from "./web-tools";
import { searchTavily } from "../../search/tavily";
import { readWebpage } from "../../search/webpage";
import { formatToolResultForModel } from "./openai-helpers";
import { getWebResourceContext } from "../web-context";

vi.mock("../../search/tavily", () => ({ searchTavily: vi.fn() }));
vi.mock("../../search/webpage", () => ({ readWebpage: vi.fn() }));
const url = "https://example.com/article";
const page = () => ({
  url,
  title: "长文章",
  costTime: 1,
  content: Array.from({ length: 500 }, (_, index) =>
    index === 400 ? "唯一限制：最多 37 个。" : `第 ${index + 1} 段说明`,
  ).join("\n"),
  images: [{ url: "https://images.example.com/body.jpg", title: "正文图片", sourceUrl: url }],
  links: ["https://example.com/specs"],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchTavily).mockResolvedValue({
    query: "说明",
    costTime: 1,
    resultNumbers: 1,
    results: [{ title: "长文章", url, content: "搜索摘要没有限制条件" }],
  });
  vi.mocked(readWebpage).mockResolvedValue(page());
});
const execute = (session: WebToolSession, name: string, args: Record<string, unknown>, id = name) =>
  session.execute(name, args, id, () => {});

it("searches, reads and finds late-page evidence with stable citations and no repeated fetch", async () => {
  const session = new WebToolSession([{ role: "user", content: "查找文章中的具体限制" }]);
  const search = await execute(session, "web_search", { query: "说明" });
  expect(search.contentKind).toBe("search_snippets");
  const read = await execute(session, "read_webpage", { url });
  expect(read.content).not.toContain("最多 37");
  expect(read.page?.nextLine).toBe(81);
  const found = await execute(session, "find_in_page", { url, pattern: "最多 37" });
  expect(found.content).toContain("401: 唯一限制：最多 37 个。");
  expect(found.page?.matches).toEqual([401]);
  expect(found.results[0].citationId).toBe(search.results[0].citationId);
  const continuation = await execute(session, "read_webpage", {
    url,
    start_line: 398,
    max_lines: 8,
  });
  expect(continuation.content).toContain("最多 37");
  expect(readWebpage).toHaveBeenCalledTimes(1);
});

it("reads a user URL directly, allows discovered links, and refuses invented destinations", async () => {
  const session = new WebToolSession([{ role: "user", content: `请阅读 ${url}` }]);
  expect((await execute(session, "read_webpage", { url })).status).toBe("done");
  expect(searchTavily).not.toHaveBeenCalled();
  expect(
    (await execute(session, "read_webpage", { url: "https://example.com/specs" })).status,
  ).toBe("done");
  expect(
    (await execute(session, "read_webpage", { url: "https://invented.example.org/" })).status,
  ).toBe("error");
  expect(readWebpage).toHaveBeenCalledTimes(2);
});

it("only displays registered images and carries selected assets into a reloaded follow-up", async () => {
  const session = new WebToolSession([{ role: "user", content: url }]);
  const read = await execute(session, "read_webpage", { url });
  expect((await execute(session, "show_images", { image_ids: ["invented"] })).status).toBe("error");
  const shown = await execute(session, "show_images", { image_ids: [read.images![0].id] });
  expect(shown.images![0].sourceUrl).toBe(url);
  const message = JSON.parse(
    JSON.stringify({
      id: "m",
      role: "model",
      content: "",
      segments: [{ type: "tool", webSearch: shown }],
    }),
  );
  const context = getWebResourceContext(message);
  expect(context?.images).toHaveLength(1);
  const followup = new WebToolSession([
    { role: "model", content: "", webContext: context },
    { role: "user", content: "再展示上一张图" },
  ]);
  expect(
    (await execute(followup, "show_images", { image_ids: [shown.images![0].id] })).status,
  ).toBe("done");
});

it("preserves cursors and valid bounded JSON under a small model context", () => {
  const excerpt = getPageExcerpt({ ...page(), content: "长内容".repeat(25000) });
  expect(excerpt.content.length).toBeLessThanOrEqual(12000);
  expect(excerpt.page.nextLine).toBeGreaterThan(1);
  const result = formatToolResultForModel(
    {
      tool: "read_webpage",
      query: url,
      url,
      title: "长标题".repeat(5000),
      results: Array.from({ length: 8 }, (_, i) => ({
        citationId: i + 1,
        title: "标题".repeat(1000),
        url: `${url}?q=${"x".repeat(2000)}`,
        content: "文字".repeat(10000),
      })),
      status: "done",
      contentKind: "page",
      ...excerpt,
    },
    2000,
  );
  expect(result.length).toBeLessThanOrEqual(2000);
  expect(JSON.parse(result)).toMatchObject({ truncated: true, page: { nextLine: 1 } });
});

it("does not reinterpret no-match or cancellation as successful evidence", async () => {
  const controller = new AbortController();
  const session = new WebToolSession([{ role: "user", content: url }], controller.signal);
  const found = await execute(session, "find_in_page", { url, pattern: "不存在的术语" });
  expect(found.page?.matches).toEqual([]);
  controller.abort();
  await expect(execute(session, "read_webpage", { url })).rejects.toThrow();
  expect(readWebpage).toHaveBeenCalledTimes(1);
});

it("redacts configured retrieval credentials in errors before emitting them", async () => {
  vi.stubEnv("TAVILY_API_KEY", "private-fixture-key");
  try {
    vi.mocked(readWebpage).mockRejectedValueOnce(new Error("读取失败 private-fixture-key"));
    const session = new WebToolSession([{ role: "user", content: url }]);
    const result = await execute(session, "read_webpage", { url });
    expect(result.status).toBe("error");
    expect(result.error).toContain("读取失败");
    expect(result.error).not.toContain("private-fixture-key");
  } finally {
    vi.unstubAllEnvs();
  }
});
