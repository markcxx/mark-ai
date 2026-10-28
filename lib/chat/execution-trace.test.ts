import { expect, it } from "vitest";
import { getExecutionTrace } from "./execution-trace";
import { toMessageVariant, applyMessageVariant } from "./message-variants";
import type { Message, MessageSegment } from "./types";

const tool: MessageSegment = {
  type: "tool",
  webSearch: { query: "新闻", results: [], status: "done" },
};
const answer: MessageSegment = { type: "content", phase: "answer", content: "最终结论" };

it("only folds identified process, keeping answers, legacy prose and deliverables visible", () => {
  const segments: MessageSegment[] = [
    { type: "thinking", content: "思考" },
    { type: "content", phase: "progress", content: "继续查证" },
    tool,
    { type: "content", content: "旧消息中的实质性内容" },
    { type: "content", phase: "progress", content: "```html\n<h1>交付物</h1>\n```" },
    {
      type: "generated-file",
      generatedFile: {
        callId: "f",
        status: "done",
        toolId: "word-document",
        toolName: "word_document_finalize",
        file: {
          id: "f",
          name: "报告.docx",
          url: "/f",
          contentType: "application/octet-stream",
          size: 1,
        },
      },
    },
    {
      type: "tool",
      webSearch: {
        query: "配图",
        tool: "show_images",
        results: [],
        status: "done",
        images: [{ id: "i", url: "/i", title: "配图" }],
      },
    },
    answer,
  ];
  expect([...getExecutionTrace(segments).processIndexes]).toEqual([0, 1, 2]);
  expect(getExecutionTrace(segments).canCollapse).toBe(true);
});

it("does not create a process group for ordinary answers or claim an unfinished trace succeeded", () => {
  expect(
    getExecutionTrace([{ type: "thinking", content: "思考" }, answer]).processIndexes.size,
  ).toBe(0);
  expect(getExecutionTrace([tool]).canCollapse).toBe(false);
  expect(
    getExecutionTrace([tool, { type: "content", content: "旧版正式回答" }]).processIndexes.size,
  ).toBe(0);
  expect(
    getExecutionTrace([tool, answer, { type: "error", content: "连接中断" }]).canCollapse,
  ).toBe(false);
});

it("retains process classification through JSON persistence and variant switching", () => {
  const original: Message = {
    id: "m",
    role: "model",
    content: "最终结论",
    segments: [tool, answer],
  };
  const variant = JSON.parse(JSON.stringify(toMessageVariant(original, "v")));
  const restored = applyMessageVariant({ ...original, segments: [] }, variant);
  expect(getExecutionTrace(restored.segments!).canCollapse).toBe(true);
  expect(restored.segments).toEqual(original.segments);
});

it("folds webpage reads containing discovered images, while keeping explicitly selected images outside", () => {
  const images = [{ id: "i", url: "https://example.com/i.png", title: "页面配图" }];
  const segments: MessageSegment[] = [
    { ...tool, stepId: "r:1", webSearch: { ...tool.webSearch, tool: "read_webpage", images } },
    { ...tool, stepId: "r:2", webSearch: { ...tool.webSearch, tool: "show_images", images } },
    answer,
  ];
  expect([...getExecutionTrace(segments).processIndexes]).toEqual([0]);
});

it("keeps the full answer before show_images visible in persisted records", () => {
  const segments: MessageSegment[] = [
    { ...tool, stepId: "r:1", webSearch: { ...tool.webSearch, tool: "read_webpage" } },
    {
      type: "content",
      stepId: "r:2",
      phase: "progress",
      content: "## 详细信息\n正式回复正文与表格。",
    },
    {
      type: "tool",
      stepId: "r:2",
      webSearch: {
        query: "图片",
        results: [],
        status: "done",
        tool: "show_images",
        images: [{ id: "i", url: "https://example.com/a.jpg", title: "图片" }],
      },
    },
    { type: "content", stepId: "r:3", phase: "answer", content: "补充说明。" },
  ];
  const restored = JSON.parse(JSON.stringify(segments));
  expect([...getExecutionTrace(restored).processIndexes]).toEqual([0]);
  expect(getExecutionTrace(restored).canCollapse).toBe(true);
  expect(getExecutionTrace(restored.slice(0, 3)).answerStarted).toBe(true);
});
it("keeps prose accompanying a chart/file artifact visible", () => {
  const segments: MessageSegment[] = [
    { type: "content", stepId: "r:1", phase: "progress", content: "这份数据的完整分析。" },
    {
      type: "generated-file",
      stepId: "r:1",
      generatedFile: {
        callId: "t",
        toolId: "data-visualization",
        toolName: "render_echarts_chart",
        status: "done",
      },
    },
    answer,
  ];
  expect(getExecutionTrace(segments).processIndexes.has(0)).toBe(false);
});
