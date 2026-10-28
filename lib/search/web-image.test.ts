import { beforeEach, expect, it, vi } from "vitest";
import { fetchWebImage } from "./web-image";
import { normalizeWebImageUrl, webImageDisplayUrl } from "../chat/web-image-url";
const fetchImage = vi.hoisted(() => vi.fn());
vi.mock("../server/public-image-fetch", () => ({ fetchPublicImage: fetchImage }));
beforeEach(() => fetchImage.mockReset());
const signal = new AbortController().signal;

it("uses the same generic route for arbitrary public image sources, including extensionless URLs", () => {
  for (const url of [
    "https://cdn.example.org/photo?token=a",
    "https://images.example.com/a.jpg",
    "https://wx4.sinaimg.cn/a.jpg",
  ]) {
    const display = new URL(
      webImageDisplayUrl(url, "https://news.example.com/article?private=1")!,
      "https://app.example",
    );
    expect(display.pathname).toBe("/api/public/web-image");
    expect(display.searchParams.get("url")).toBe(url);
    expect(display.searchParams.get("source")).toBe("https://news.example.com");
  }
});
it.each([
  "http://127.1/a",
  "http://localhost/a",
  "http://192.168.1.1/a",
  "http://[::1]/a",
  "http://host.internal/a",
  "https://user:pass@example.com/a",
  "https://example.com:8080/a",
  "file:///a",
])("rejects unsafe URL %s", (url) => {
  expect(normalizeWebImageUrl(url)).toBeUndefined();
});
it("fetches image bytes using only the source origin as referer", async () => {
  fetchImage.mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
  );
  const result = await fetchWebImage(
    "https://cdn.example.org/a",
    signal,
    "https://news.example.org/article",
  );
  expect([...result.bytes]).toEqual([1, 2, 3]);
  expect(fetchImage.mock.calls[0][1].headers).toEqual({
    Accept: expect.any(String),
    Referer: "https://news.example.org/",
  });
  expect(fetchImage.mock.calls[0][1].redirect).toBe("manual");
});
it("rejects a redirect to a private host before making another request", async () => {
  fetchImage.mockResolvedValue(
    new Response(null, { status: 302, headers: { location: "http://169.254.169.254/secret" } }),
  );
  await expect(fetchWebImage("https://cdn.example.org/a", signal)).rejects.toThrow("重定向");
  expect(fetchImage).toHaveBeenCalledTimes(1);
});
it.each(["text/html", "image/svg+xml"])("rejects active document type %s", async (type) => {
  fetchImage.mockResolvedValue(new Response("document", { headers: { "content-type": type } }));
  await expect(fetchWebImage("https://cdn.example.org/a", signal)).rejects.toThrow("无法加载");
});
it("bounds a chunked response even without content-length", async () => {
  fetchImage.mockResolvedValue(
    new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } }),
  );
  await expect(fetchWebImage("https://cdn.example.org/a", signal)).rejects.toThrow("过大");
});
it("bounds redirect loops", async () => {
  fetchImage.mockImplementation(
    async () => new Response(null, { status: 302, headers: { location: "/again" } }),
  );
  await expect(fetchWebImage("https://cdn.example.org/a", signal)).rejects.toThrow("次数过多");
  expect(fetchImage).toHaveBeenCalledTimes(4);
});
