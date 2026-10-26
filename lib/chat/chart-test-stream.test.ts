import { expect, it } from "vitest";
import { applyChartPreviewEvent, finishChartPreviewMessage } from "./chart-test-stream";
import type { Message, GeneratedFileState } from "./types";
const initial = (): Message => ({
  id: "preview",
  role: "model",
  content: "",
  segments: [],
  isStreaming: true,
});
const tool: GeneratedFileState = {
  callId: "chart-1",
  toolId: "data-visualization",
  toolName: "render_echarts_chart",
  status: "running",
};
it("renders thought, tool status and chart content in their streamed order without duplicate tool rows", () => {
  let message = applyChartPreviewEvent(initial(), { type: "reasoning", text: "先分析" });
  expect(message.isReasoning).toBe(true);
  message = applyChartPreviewEvent(message, { type: "reasoning", text: "数据" });
  message = applyChartPreviewEvent(message, { type: "file", generatedFile: tool });
  message = applyChartPreviewEvent(message, {
    type: "file",
    generatedFile: { ...tool, status: "done" },
  });
  message = applyChartPreviewEvent(message, { type: "content", text: "```echarts\n" });
  message = applyChartPreviewEvent(message, { type: "content", text: "{}\n```" });
  expect(message.segments?.map((segment) => segment.type)).toEqual([
    "thinking",
    "generated-file",
    "content",
  ]);
  expect(message.segments?.[0]).toMatchObject({ content: "先分析数据", isActive: false });
  expect(message.segments?.[1]).toMatchObject({ generatedFile: { status: "done" } });
  expect(message.content).toBe("```echarts\n{}\n```");
});
it("retains streamed text and raw errors after a failure", () => {
  let message = applyChartPreviewEvent(initial(), { type: "content", text: "已输出的正文" });
  message = applyChartPreviewEvent(message, {
    type: "error",
    text: 'HTTP 400\n{"error":"original"}',
  });
  expect(message).toMatchObject({ content: "已输出的正文", isStreaming: false, interrupted: true });
  expect(message.segments?.at(-1)).toMatchObject({
    type: "error",
    content: 'HTTP 400\n{"error":"original"}',
  });
});
it("ends active thoughts and pending tools when stopped", () => {
  const thinking = applyChartPreviewEvent(initial(), { type: "reasoning", text: "分析中" });
  expect(finishChartPreviewMessage(thinking)).toMatchObject({
    isStreaming: false,
    isReasoning: false,
    segments: [{ isActive: false }],
  });
  const pending = applyChartPreviewEvent(initial(), { type: "file", generatedFile: tool });
  expect(finishChartPreviewMessage(pending).segments?.[0]).toMatchObject({
    generatedFile: { status: "error" },
  });
});

it("keeps separate reads of the same URL and stops pending web calls", () => {
  const state = {
    tool: "read_webpage" as const,
    query: "https://example.com/a",
    results: [],
    status: "searching" as const,
  };
  let message = applyChartPreviewEvent(initial(), {
    type: "tool",
    webSearch: { ...state, callId: "first" },
  });
  message = applyChartPreviewEvent(message, {
    type: "tool",
    webSearch: { ...state, callId: "first", status: "done" },
  });
  message = applyChartPreviewEvent(message, {
    type: "tool",
    webSearch: { ...state, callId: "next" },
  });
  expect(message.segments).toHaveLength(2);
  expect(finishChartPreviewMessage(message).segments).toMatchObject([
    { webSearch: { callId: "first", status: "done" } },
    { webSearch: { callId: "next", status: "error" } },
  ]);
});
