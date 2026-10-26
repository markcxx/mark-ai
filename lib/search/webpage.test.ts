import { beforeEach, expect, it, vi } from "vitest";
import { readWebpage } from "./webpage";

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) },
}));
const fetchMock = vi.fn();
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
  vi.stubEnv("TAVILY_API_KEY", "fixture-key");
  const controller = new AbortController();
  fetchMock.mockImplementation(async () => {
    controller.abort();
    throw new DOMException("Stopped", "AbortError");
  });
  await expect(
    readWebpage({ url: "https://example.com/article", signal: controller.signal }),
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
