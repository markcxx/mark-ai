import { beforeEach, expect, it, vi } from "vitest";
import { fetchWebImage } from "./web-image";
import { normalizeWebImageUrl, webImageDisplayUrl } from "../chat/web-image-url";
const fetchImage = vi.hoisted(() => vi.fn());
vi.mock("../server/public-image-fetch", () => ({ fetchPublicImage: fetchImage }));
beforeEach(() => fetchImage.mockReset());
const signal = new AbortController().signal;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB9kAAAAASUVORK5CYII=",
  "base64",
);

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
    new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } }),
  );
  const result = await fetchWebImage(
    "https://cdn.example.org/a",
    signal,
    "https://news.example.org/article",
  );
  expect(result.bytes).toEqual(png);
  expect(result.type).toBe("image/png");
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
it.each([undefined, "application/octet-stream", "image/jpeg", "text/plain"])(
  "identifies image bytes regardless of upstream type %s or URL extension",
  async (type) => {
    fetchImage.mockResolvedValue(
      new Response(new Uint8Array(png), {
        headers: type ? { "content-type": type } : {},
      }),
    );
    const result = await fetchWebImage("https://cdn.example.org/asset?id=42", signal);
    expect(result).toEqual({ bytes: png, type: "image/png" });
  },
);
it("serves binary-labeled WebP with the detected image MIME", async () => {
  const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");
  fetchImage.mockResolvedValue(
    new Response(new Uint8Array(webp), {
      headers: { "content-type": "application/octet-stream" },
    }),
  );
  expect(await fetchWebImage("https://assets.example.net/render/123", signal)).toEqual({
    bytes: webp,
    type: "image/webp",
  });
});
it.each([
  "<html><body>Access denied</body></html>",
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  '{"error":"not found"}',
])("rejects non-image bytes even with an image MIME and extension: %s", async (body) => {
  fetchImage.mockResolvedValue(new Response(body, { headers: { "content-type": "image/png" } }));
  await expect(fetchWebImage("https://cdn.example.org/photo.png", signal)).rejects.toThrow(
    "格式无法识别",
  );
});
it("recognizes an image whose signature crosses stream chunk boundaries", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(png.subarray(0, 3)));
      controller.enqueue(new Uint8Array(png.subarray(3)));
      controller.close();
    },
  });
  fetchImage.mockResolvedValue(new Response(body));
  expect(await fetchWebImage("https://cdn.example.org/asset", signal)).toEqual({
    bytes: png,
    type: "image/png",
  });
});
it("rejects upstream errors even if their body looks like an image", async () => {
  fetchImage.mockResolvedValue(new Response(new Uint8Array(png), { status: 403 }));
  await expect(fetchWebImage("https://cdn.example.org/asset", signal)).rejects.toThrow("无法加载");
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
