import { expect, it } from "vitest";
import {
  extractWebImages,
  extractWebLinks,
  normalizeWebImages,
  publicResourceUrl,
} from "./web-assets";

it("extracts body pictures, lazy sources and captions while excluding page chrome", () => {
  const images = extractWebImages(
    '<header><img src="/banner.jpg"></header><article><img src="/one.jpg" alt="建筑正面"><img data-src="/two.webp" src="data:image/gif;base64,x" alt="建筑屋顶"><img src="/tracking.gif" width="1" height="1"></article>',
    "https://example.com/article",
  );
  expect(images.map((image) => image.url)).toEqual([
    "https://example.com/one.jpg",
    "https://example.com/two.webp",
  ]);
  expect(images[0]).toMatchObject({ title: "建筑正面", sourceUrl: "https://example.com/article" });
});

it("keeps Markdown pictures separate from navigable article links", () => {
  const text = "![外观](/photo.jpg)\n[规格](./specs)\n[脚本](javascript:alert)";
  expect(extractWebImages(text, "https://example.com/article")[0].url).toBe(
    "https://example.com/photo.jpg",
  );
  expect(extractWebLinks(text, "https://example.com/article")).toEqual([
    "https://example.com/specs",
  ]);
});

it("rejects unsafe schemes, credentials and private image URLs and deduplicates results", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/png;base64,x",
    "http://127.0.0.1/a",
    "http://2130706433/a",
    "http://[::1]/a",
    "https://user:secret@example.com/p",
    "http://foo.local/p",
    "http://169.254.169.254/latest",
  ])
    expect(publicResourceUrl(url)).toBeUndefined();
  const images = normalizeWebImages([
    "https://example.com/a.jpg",
    "https://example.com/a.jpg",
    "http://127.0.0.1/a.jpg",
  ]);
  expect(images).toHaveLength(1);
  expect(images[0].sourceUrl).toBeUndefined();
});

it("provides captions and nearby article text for relevance selection without a separate search", () => {
  const [image] = extractWebImages(
    '<article><h1>发布会现场</h1><p>新设备发布现场的演示照片。</p><figure><img src="/event.jpg"><figcaption>现场演示新设备</figcaption></figure><p>主讲人介绍功能。</p></article>',
    "https://example.com/news",
  );
  expect(image.title).toBe("现场演示新设备");
  expect(image.description).toContain("图片说明：现场演示新设备");
  expect(image.description).toContain("相邻正文：");
  expect(image.description).toContain("主讲人介绍功能");
  expect(image.description).not.toContain("<");
});
