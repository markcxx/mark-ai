import { expect, it } from "vitest";
import {
  normalizeWebResourceContext,
  getWebResourceContext,
  contentWithWebContext,
  finishPendingWebTools,
} from "./web-context";
import { prepareRequestHistory } from "./request-history";
import { estimateContextMessagesTokens } from "./context-window";
import type { Message, MessageSegment } from "./types";

it("bounds untrusted asset context and excludes private and credentialed destinations", () => {
  expect(
    normalizeWebResourceContext({
      images: [null, { id: "x", url: "http://127.0.0.1/x.jpg" }],
      sources: [{ url: "https://user:pass@example.com/" }],
    }),
  ).toBeUndefined();
  const context = normalizeWebResourceContext({
    images: Array.from({ length: 20 }, (_, i) => ({
      id: `img_${i}`,
      url: `https://example.com/${i}.jpg`,
      title: "a".repeat(1000),
    })),
    sources: Array.from({ length: 20 }, () => ({
      url: "https://example.com/",
      title: "b".repeat(1000),
    })),
  })!;
  expect(context.images).toHaveLength(6);
  expect(context.sources).toHaveLength(8);
  expect(context.images[0].title).toHaveLength(300);
});

it("retains image-only turns after persistence and includes asset context in token accounting", () => {
  const message: Message = {
    id: "m",
    role: "model",
    content: "",
    segments: [
      {
        type: "tool",
        webSearch: {
          tool: "show_images",
          status: "done",
          query: "图片",
          results: [{ title: "文章", url: "https://example.com/a" }],
          images: [
            {
              id: "img_test",
              title: "正文配图",
              url: "https://example.com/a.jpg",
              sourceUrl: "https://example.com/a",
            },
          ],
        },
      },
    ],
  };
  const restored = JSON.parse(JSON.stringify(message));
  const history = { role: "model", content: "", webContext: getWebResourceContext(restored) };
  expect(prepareRequestHistory([history])).toEqual([history]);
  expect(contentWithWebContext(history)).toContain("正文配图");
  expect(estimateContextMessagesTokens([history])).toBeGreaterThan(
    estimateContextMessagesTokens([{ role: "model", content: "" }]),
  );
});

it("marks pending reads as interrupted without losing completed galleries or mutating the input", () => {
  const segments: MessageSegment[] = [
    {
      type: "tool",
      webSearch: {
        tool: "read_webpage",
        status: "searching",
        query: "https://example.com/a",
        results: [],
      },
    },
    {
      type: "tool",
      webSearch: { tool: "show_images", status: "done", query: "图片", results: [], images: [] },
    },
  ];
  const next = finishPendingWebTools(segments, "用户停止");
  expect(next[0]).toMatchObject({ webSearch: { status: "error", error: "用户停止" } });
  expect(next[1]).toEqual(segments[1]);
  expect(segments[0]).toMatchObject({ webSearch: { status: "searching" } });
});
