import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WebSearchToolBlockItem } from "./WebSearchToolBlock";

it("renders selected pictures without captions or URLs outside collapsed tool details", () => {
  const html = renderToStaticMarkup(
    <WebSearchToolBlockItem
      webSearch={{
        tool: "show_images",
        query: "图片",
        status: "done",
        results: [],
        images: [
          {
            id: "image",
            url: "https://images.example.com/body.jpg",
            title: "正文图片",
            sourceUrl: "https://example.com/article",
          },
          { id: "unsafe", url: "http://127.0.0.1/private.jpg", title: "不显示" },
        ],
      }}
    />,
  );
  expect(html).toContain('aria-label="网页图片"');
  expect(html).toContain('src="https://images.example.com/body.jpg"');
  expect(html).not.toContain("<figcaption");
  expect(html).not.toContain("<a ");
  expect(html).toContain('referrerPolicy="no-referrer"');
  expect(html).not.toContain("127.0.0.1");
  expect(html).not.toContain("aria-expanded");
});
