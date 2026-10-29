import { expect, it } from "vitest";
import { assessWebContent, cleanWebContent } from "./content-quality";

it("removes a navigation prefix while preserving article text, code and tables", () => {
  const body =
    "# 真实文档\n\n正文中的限制为 37。\n```js\n  const x = 'accept all cookies';\n```\n| 名称 | 值 |\n|---|---|\n| A | 1 |";
  const prefix = Array.from({ length: 8 }, (_, i) => `- [导航${i}](https://example.com/${i})`).join(
    "\n",
  );
  expect(cleanWebContent(`${prefix}\n${body}`)).toBe(body);
});

it("keeps link catalogs and research reference lists usable", () => {
  const directory =
    "# API 目录\n" +
    Array.from({ length: 30 }, (_, i) => `- [API ${i}](https://example.com/${i})`).join("\n");
  expect(cleanWebContent(directory)).toBe(directory);
  expect(assessWebContent(directory).usable).toBe(true);
});

it("rejects an interstitial but keeps articles discussing access denial and CAPTCHAs", () => {
  expect(assessWebContent("Please verify you are human", "Just a moment").usable).toBe(false);
  expect(
    assessWebContent("本教程解释 captcha 与 access denied 的处理方式。", "验证码教程").usable,
  ).toBe(true);
});

it("recognizes mostly unrelated navigation without rejecting short factual answers", () => {
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
  expect(assessWebContent(nav)).toMatchObject({ usable: false, noisy: true });
  expect(assessWebContent("最大值为 37。").usable).toBe(true);
});
