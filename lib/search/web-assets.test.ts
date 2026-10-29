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

it("associates Markdown pictures with their section without leaking the next subject or image URLs", () => {
  const images = extractWebImages(
    [
      "## 会场布局",
      "入口位于舞台左侧。",
      "![会场全景](/venue.jpg)",
      "观众席围绕主舞台布置。[布局说明](/layout)",
      "![侧面视角](/side.jpg)",
      "## 新款设备",
      "设备采用可折叠设计。",
      "![](/device.jpg)",
      "屏幕可向外翻转。",
    ].join("\n\n"),
    "https://example.com/news",
    ["https://example.com/venue.jpg"],
  );
  expect(images).toHaveLength(3);
  expect(images[0].title).toBe("会场全景");
  expect(images[0].description).toContain("所属小节：会场布局");
  expect(images[0].description).toContain("入口位于舞台左侧");
  expect(images[0].description).toContain("观众席围绕主舞台布置");
  expect(images[0].description).not.toMatch(/设备|side\.jpg|\/layout|!\[/);
  expect(images[2].description).toContain("所属小节：新款设备");
  expect(images[2].description).toContain("屏幕可向外翻转");
  expect(images[2].description).not.toContain("会场");
});

it("keeps Markdown context bounded and works without a heading or image caption", () => {
  const [image] = extractWebImages(
    `${"很长的正文".repeat(1000)}\n建筑的入口\n![](/building.jpg)\n屋顶的结构\n${"很长的正文".repeat(1000)}`,
    "https://example.com/news",
  );
  expect(image.description).toContain("建筑的入口");
  expect(image.description).toContain("屋顶的结构");
  expect(image.description!.length).toBeLessThanOrEqual(300);
});
