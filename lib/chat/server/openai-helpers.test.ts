import { describe, expect, it } from "vitest";

import {
  compactWebToolHistory,
  formatToolResultForModel,
  toOpenAIMessages,
} from "./openai-helpers";

describe("toOpenAIMessages", () => {
  it("passes assistant reasoning back only to reasoning-aware requests", () => {
    const input = {
      messages: [{ role: "model" as const, content: "answer", reasoning: "earlier reasoning" }],
      webSearchEnabled: true,
    };
    expect(toOpenAIMessages({ ...input, preserveReasoning: true })[1]).toMatchObject({
      reasoning_content: "earlier reasoning",
    });
    expect(toOpenAIMessages(input)[1]).not.toHaveProperty("reasoning_content");
  });
  it("keeps text-only messages as strings", () => {
    const messages = toOpenAIMessages({
      messages: [{ content: "hello", role: "user" }],
      webSearchEnabled: false,
    });

    expect(messages[1]).toMatchObject({ content: "hello", role: "user" });
  });

  it("converts prepared images to OpenAI-compatible image_url parts", () => {
    const messages = toOpenAIMessages({
      messages: [
        {
          content: "这是什么？",
          imageInputs: [{ data: "aGVsbG8=", mediaType: "image/png", name: "sample.png" }],
          role: "user",
        },
      ],
      webSearchEnabled: false,
    });

    expect(messages[1]).toEqual({
      content: [
        { text: "这是什么？", type: "text" },
        {
          image_url: { url: "data:image/png;base64,aGVsbG8=" },
          type: "image_url",
        },
      ],
      role: "user",
    });
  });
});

it("keeps publication dates and more than eight requested search results", () => {
  const payload = JSON.parse(
    formatToolResultForModel({
      tool: "web_search",
      query: "搜索",
      status: "done",
      contentKind: "search_snippets",
      results: Array.from({ length: 15 }, (_, index) => ({
        citationId: index + 1,
        title: `来源 ${index}`,
        url: `https://example.com/${index}`,
        publishedDate: "2026-10-29",
        content: "有效事实",
      })),
    }),
  );
  expect(payload.results).toHaveLength(15);
  expect(payload.results[0].publishedDate).toBe("2026-10-29");
});

it("keeps a correct resume cursor when model evidence is shortened", () => {
  const payload = JSON.parse(
    formatToolResultForModel(
      {
        tool: "read_webpage",
        query: "https://example.com/",
        status: "done",
        contentKind: "page",
        content: Array.from({ length: 100 }, (_, i) => `${i + 1}: ${"正文".repeat(30)}`).join("\n"),
        page: { startLine: 1, endLine: 100, totalLines: 100 },
        results: [{ title: "文章", url: "https://example.com/", citationId: 1 }],
      },
      2000,
    ),
  );
  const last = Number(payload.content.split("\n").at(-1).split(":")[0]);
  expect(payload.page.endLine).toBe(last);
  expect(payload.page.nextLine).toBe(last + 1);
  expect(payload.page.truncated).toBe(true);
});

it("bounds accumulated web evidence without mutating persisted payloads or dropping protocol entries", () => {
  const original = Array.from({ length: 50 }, (_, i) =>
    formatToolResultForModel({
      tool: "web_search",
      query: `查询${i}`,
      status: "done",
      contentKind: "search_snippets",
      results: [
        {
          title: "来源",
          url: `https://example.com/${i}`,
          citationId: i + 1,
          publishedDate: "2026-10-29",
          content: "正文".repeat(2500),
        },
      ],
    }),
  );
  const compacted = [...original];
  compactWebToolHistory(
    compacted.map((content, index) => ({
      content,
      replace: (value) => {
        compacted[index] = value;
      },
    })),
  );
  expect(compacted).toHaveLength(original.length);
  expect(compacted.join("").length).toBeLessThanOrEqual(48000);
  expect(original.join("").length).toBeGreaterThan(48000);
  expect(JSON.parse(compacted[0]).context_compacted).toBe(true);
  expect(compacted.slice(-4)).toEqual(original.slice(-4));
  expect(JSON.parse(original[0]).results[0].content).toHaveLength(5000);
});

it("preserves full search snippets when they fit the result budget", () => {
  const payload = JSON.parse(
    formatToolResultForModel({
      tool: "web_search",
      query: "资料",
      status: "done",
      contentKind: "search_snippets",
      results: [
        {
          title: "来源",
          url: "https://example.com/",
          citationId: 1,
          publishedDate: "2026-10-29",
          content: "资料".repeat(1000),
        },
      ],
    }),
  );
  expect(payload.results[0]).toMatchObject({
    citationId: 1,
    publishedDate: "2026-10-29",
  });
  expect(payload.results[0].content).toHaveLength(2000);
});

it("protects the latest page window from accumulated history under a small budget", () => {
  const history: string[] = [];
  for (let index = 0; index < 25; index++) {
    const startLine = index * 10 + 1;
    const latest = formatToolResultForModel({
      tool: "read_webpage",
      query: "https://example.com/",
      url: "https://example.com/",
      status: "done",
      contentKind: "page",
      content: Array.from(
        { length: 10 },
        (_, offset) => `${startLine + offset}: ${"榜单正文".repeat(20)}`,
      ).join("\n"),
      page: { startLine, endLine: startLine + 9, totalLines: 250 },
      results: [{ title: "榜单", url: "https://example.com/", citationId: 1 }],
    });
    history.push(latest);
    compactWebToolHistory(
      history.map((content, position) => ({
        content,
        replace: (value) => {
          history[position] = value;
        },
      })),
      4000,
    );
    expect(history.join("").length).toBeLessThanOrEqual(4000);
    expect(history.at(-1)).toBe(latest);
  }
});

it("returns a small display acknowledgment without repeating image descriptions", () => {
  const payload = JSON.parse(
    formatToolResultForModel({
      tool: "show_images",
      query: "图片展示",
      status: "done",
      results: [],
      images: [
        {
          id: "img-1",
          title: "图片说明".repeat(100),
          description: "相邻正文".repeat(100),
          url: "https://example.com/a.jpg",
        },
      ],
    }),
  );
  expect(payload.image_ids).toEqual(["img-1"]);
  expect(payload.images).toBeUndefined();
  expect(JSON.stringify(payload).length).toBeLessThan(200);
});

it("deduplicates identical evidence but retains different excerpts and protocol entries", () => {
  const make = (content: string, cached: boolean) =>
    formatToolResultForModel({
      tool: "read_webpage",
      query: "https://example.com/",
      url: "https://example.com/",
      status: "done",
      contentKind: "page",
      content,
      retrieval: { provider: "tavily", mode: "basic", cached, attempts: [] },
      results: [{ title: "来源", url: "https://example.com/", citationId: 1 }],
    });
  const original = [
    make("1: 原始段落", false),
    make("1: 原始段落", true),
    make("2: 不同段落", true),
  ];
  const output = [...original];
  compactWebToolHistory(
    output.map((content, index) => ({
      content,
      replace: (value) => {
        output[index] = value;
      },
    })),
  );
  expect(output).toHaveLength(3);
  expect(JSON.parse(output[0])).toMatchObject({ context_compacted: true, duplicate_result: true });
  expect(JSON.parse(output[1]).content).toBe("1: 原始段落");
  expect(JSON.parse(output[2]).content).toBe("2: 不同段落");
  expect(JSON.parse(original[0]).content).toBe("1: 原始段落");
});

it("bounds a default page result and preserves a cursor to omitted evidence", () => {
  const output = formatToolResultForModel({
    tool: "read_webpage",
    query: "https://example.com/",
    status: "done",
    contentKind: "page",
    content: Array.from({ length: 100 }, (_, index) => `${index + 1}: ${"正文".repeat(60)}`).join(
      "\n",
    ),
    page: { startLine: 1, endLine: 100, totalLines: 100 },
    results: [{ title: "文章", url: "https://example.com/", citationId: 1 }],
  });
  expect(output.length).toBeLessThanOrEqual(8000);
  expect(output.length).toBeGreaterThan(4000);
  const payload = JSON.parse(output);
  const last = Number(payload.content.split("\n").at(-1).split(":")[0]);
  expect(payload.page.nextLine).toBe(last + 1);
  expect(payload.results[0].citationId).toBe(1);
});
