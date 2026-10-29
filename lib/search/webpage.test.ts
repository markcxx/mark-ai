import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readWebpage } from "./webpage";

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) },
}));
const fetchMock = vi.fn();
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("FIRECRAWL_API_KEY", "");
  vi.stubEnv("TAVILY_API_KEY", "");
});

it("retains late page evidence and extracts images before stripping HTML", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      `<html><title>说明</title><article><p>${"早期内容 ".repeat(5000)}</p><p>唯一限制：最多 37 个。</p><img src="/article.jpg" alt="文章配图"><a href="/details">详细条件</a></article></html>`,
      { headers: { "content-type": "text/html" } },
    ),
  );
  const page = await readWebpage({ url: "https://example.com/article" });
  expect(page.content.length).toBeGreaterThan(18000);
  expect(page.content).toContain("最多 37 个");
  expect(page.images?.[0]).toMatchObject({
    url: "https://example.com/article.jpg",
    sourceUrl: "https://example.com/article",
  });
  expect(page.links).toContain("https://example.com/details");
});

it("requests native image extraction from Tavily", async () => {
  vi.stubEnv("TAVILY_API_KEY", "fixture-key");
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          {
            url: "https://example.com/article",
            raw_content: "网页正文",
            images: ["https://cdn.example.com/photo.jpg"],
          },
        ],
      }),
    ),
  );
  const page = await readWebpage({ url: "https://example.com/article" });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).include_images).toBe(true);
  expect(page.images?.[0].sourceUrl).toBe("https://example.com/article");
});

it("blocks a redirect into private space", async () => {
  fetchMock.mockResolvedValue(
    new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }),
  );
  await expect(readWebpage({ url: "https://example.com/article" })).rejects.toThrow("内网");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("does not start fallback providers after the user cancels", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "cancel-firecrawl");
  vi.stubEnv("TAVILY_API_KEY", "fixture-key");
  const controller = new AbortController();
  fetchMock.mockImplementation(async () => {
    controller.abort();
    throw new DOMException("Stopped", "AbortError");
  });
  await expect(
    readWebpage({
      url: "https://example.com/article",
      provider: "firecrawl",
      signal: controller.signal,
    }),
  ).rejects.toThrow();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("prefers body images over a generic Firecrawl social thumbnail", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "fixture-key");
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: "正文说明\n![正文配图](https://example.com/body.jpg)",
          metadata: { title: "文章", ogImage: "https://example.com/wechat_share.png" },
        },
      }),
    ),
  );
  const page = await readWebpage({ url: "https://example.com/article" });
  expect(page.images?.map((image) => image.url)).toEqual(["https://example.com/body.jpg"]);
});

it("rejects credentialed URLs before making any network request", async () => {
  await expect(readWebpage({ url: "https://user:password@example.com/article" })).rejects.toThrow(
    "账号或密码",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it("prefers Firecrawl without starting Tavily or LLM cleaning", async () => {
  vi.stubEnv("TAVILY_API_KEY", "fast-tavily");
  vi.stubEnv("FIRECRAWL_API_KEY", "fast-firecrawl");
  fetchMock.mockImplementation(async () =>
    Response.json({ success: true, data: { markdown: "有效正文。" } }),
  );
  const page = await readWebpage({ url: "https://example.com/article", provider: "firecrawl" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.firecrawl.dev/v2/scrape");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    onlyCleanContent: false,
    timeout: 8000,
  });
  expect(page.retrieval).toMatchObject({ provider: "firecrawl", mode: "basic" });
});

it("waits for a slow Firecrawl result instead of racing it with Tavily", async () => {
  vi.useFakeTimers();
  vi.stubEnv("TAVILY_API_KEY", "unused-tavily");
  vi.stubEnv("FIRECRAWL_API_KEY", "slow-firecrawl");
  fetchMock.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return Response.json({ success: true, data: { markdown: "# 页面\n合格正文" } });
  });
  const pending = readWebpage({ url: "https://example.com/article", provider: "firecrawl" });
  await vi.advanceTimersByTimeAsync(1200);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.firecrawl.dev/v2/scrape");
  await vi.advanceTimersByTimeAsync(3800);
  expect((await pending).retrieval).toMatchObject({ provider: "firecrawl", mode: "basic" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("falls back to Tavily only after Firecrawl times out", async () => {
  vi.useFakeTimers();
  vi.stubEnv("TAVILY_API_KEY", "slow-tavily");
  vi.stubEnv("FIRECRAWL_API_KEY", "backup-firecrawl");
  let primary: AbortSignal | undefined;
  fetchMock.mockImplementation(async (url, init) => {
    if (String(url).includes("firecrawl")) {
      primary = init.signal;
      return new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(init.signal.reason)),
      );
    }
    return Response.json({ results: [{ raw_content: "# 页面\n合格正文" }] });
  });
  const pending = readWebpage({ url: "https://example.com/article", provider: "firecrawl" });
  await vi.advanceTimersByTimeAsync(9999);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  const result = await pending;
  expect(result.retrieval).toMatchObject({ provider: "tavily", mode: "basic" });
  expect(primary?.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("falls back immediately when Firecrawl fails", async () => {
  vi.stubEnv("TAVILY_API_KEY", "fallback-tavily");
  vi.stubEnv("FIRECRAWL_API_KEY", "failed-firecrawl");
  fetchMock.mockImplementation(async (url) =>
    String(url).includes("firecrawl")
      ? new Response(null, { status: 503 })
      : Response.json({ results: [{ raw_content: "备用正文" }] }),
  );
  const page = await readWebpage({ url: "https://example.com/article", provider: "firecrawl" });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://api.firecrawl.dev/v2/scrape",
    "https://api.tavily.com/extract",
  ]);
  expect(page.retrieval).toMatchObject({ provider: "tavily", mode: "basic" });
});

it("only enables LLM cleaning after fast readers return unusable navigation", async () => {
  vi.stubEnv("TAVILY_API_KEY", "noise-tavily");
  vi.stubEnv("FIRECRAWL_API_KEY", "noise-firecrawl");
  const nav = [
    "首页",
    "登录",
    "注册",
    "新闻",
    "体育",
    "财经",
    "娱乐",
    "科技",
    "博客",
    "汽车",
    "房产",
    "教育",
    "时尚",
    "更多",
  ]
    .map((label) => `- [${label}](https://example.com/)`)
    .join("\n");
  fetchMock.mockImplementation(async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).includes("tavily")) return Response.json({ results: [{ raw_content: nav }] });
    return Response.json({
      success: true,
      data: { markdown: body.onlyCleanContent ? "# 正文\n真正的内容。" : nav },
    });
  });
  const result = await readWebpage({ url: "https://example.com/article" });
  expect(result.content).toContain("真正的内容");
  expect(result.retrieval).toMatchObject({ provider: "firecrawl", mode: "clean" });
  expect(
    fetchMock.mock.calls
      .map(([, init]) => JSON.parse(init.body).onlyCleanContent)
      .filter((value) => value !== undefined),
  ).toEqual([false, true]);
});

it.each([undefined, "auto", "tavily"] as const)(
  "prefers Tavily for text reading with provider %s",
  async (provider) => {
    vi.stubEnv("TAVILY_API_KEY", "text-tavily");
    vi.stubEnv("FIRECRAWL_API_KEY", "unused-firecrawl");
    fetchMock.mockResolvedValue(Response.json({ results: [{ raw_content: "文字正文" }] }));
    const result = await readWebpage({ url: "https://example.com/article", provider });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.tavily.com/extract");
    expect(result.retrieval).toMatchObject({
      provider: "tavily",
      requestedProvider: provider || "auto",
    });
  },
);

it("uses Firecrawl when the selected Tavily reader fails", async () => {
  vi.stubEnv("TAVILY_API_KEY", "failed-text-tavily");
  vi.stubEnv("FIRECRAWL_API_KEY", "backup-image-firecrawl");
  fetchMock.mockImplementation(async (url) =>
    String(url).includes("tavily")
      ? new Response(null, { status: 503 })
      : Response.json({ success: true, data: { markdown: "备用正文" } }),
  );
  const result = await readWebpage({ url: "https://example.com/article", provider: "tavily" });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://api.tavily.com/extract",
    "https://api.firecrawl.dev/v2/scrape",
  ]);
  expect(result.retrieval).toMatchObject({ requestedProvider: "tavily", provider: "firecrawl" });
});
