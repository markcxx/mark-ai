import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Message, MessageSegment } from "@/lib/chat/types";
import { getExecutionTrace } from "@/lib/chat/execution-trace";
import { MessageSegments } from "./MessageSegments";

vi.mock("../MarkdownContent", () => ({
  MarkdownContent: ({ children }: { children: string }) => <p>{children}</p>,
}));
vi.mock("../ThinkingPanel", () => ({ ThinkingPanel: () => null }));
vi.mock("./GeneratedFileToolBlock", () => ({
  GeneratedFileToolBlock: () => <span>交付文件</span>,
}));
vi.mock("./GeneratedImageBlock", () => ({ GeneratedImageBlock: () => <span>生成图片</span> }));
vi.mock("./WebSearchToolBlock", () => ({
  WebSearchToolBlockItem: ({ webSearch }: { webSearch: { tool?: string; callId?: string } }) => (
    <span>{webSearch.tool === "show_images" ? `图集-${webSearch.callId}` : "读取网页记录"}</span>
  ),
}));

const segments: MessageSegment[] = [
  {
    type: "tool",
    stepId: "r:1",
    webSearch: {
      tool: "read_webpage",
      query: "新闻",
      status: "done",
      results: [],
      images: [{ id: "i", title: "页面图片", url: "/i" }],
    },
  },
  { type: "content", stepId: "r:2", phase: "answering", content: "正式回答正在输出" },
];
const message: Message = { id: "m", role: "model", content: "正式回答正在输出", isStreaming: true };
const render = (value: Message, items = segments) =>
  renderToStaticMarkup(
    <MessageSegments
      animation="none"
      citations={[]}
      message={value}
      onPreview={() => {}}
      segments={items}
    />,
  );

it("shows completed, collapsed execution while the answer is still streaming", () => {
  const html = render(message);
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("执行完成");
  expect(html).not.toContain("正在执行");
  expect(html).toMatch(/aria-hidden="true"[^]*读取网页记录/);
  expect(html).toContain("正式回答正在输出");
});

it("keeps reasoning, resumed tools and interrupted answers expanded", () => {
  expect(render({ ...message, isReasoning: true })).toContain('aria-expanded="true"');
  expect(render({ ...message, isStreaming: false, interrupted: true })).toContain(
    'aria-expanded="true"',
  );
  const resumed: MessageSegment[] = [
    segments[0],
    { ...segments[1], phase: "progress" } as MessageSegment,
  ];
  const html = render(message, resumed);
  expect(html).toContain('aria-expanded="true"');
  expect(html).toContain("正在执行");
});

it.each([0, 1, 2])("keeps model-selected images at paragraph position %s after reload", (position) => {
  const content: MessageSegment[] = [
    { type: "content", stepId: "r:2", phase: "progress", content: "第一段正文" },
    { type: "content", stepId: "r:2", phase: "progress", content: "第二段正文" },
  ];
  content.splice(position, 0, {
    type: "tool",
    stepId: "r:2",
    webSearch: {
      callId: "selected",
      tool: "show_images",
      query: "图片",
      status: "done",
      results: [],
      images: [{ id: "i", title: "配图", url: "https://example.com/i.jpg" }],
    },
  });
  const items = JSON.parse(JSON.stringify([segments[0], ...content]));
  const html = render({ ...message, isStreaming: false }, items);
  expect(html.match(/第一段正文|第二段正文|图集-selected/g)).toEqual(
    content.map((item) => (item.type === "content" ? item.content : "图集-selected")),
  );
  // Answer paragraphs must be outside the process accordion, not just in DOM order.
  expect([...getExecutionTrace(items).processIndexes]).toEqual([0]);
});

it("preserves separate image groups between answer sections while streaming", () => {
  const items: MessageSegment[] = [segments[0]];
  for (let index = 0; index < 2; index++) {
    items.push(
      { type: "content", stepId: `r:${index + 2}`, phase: "progress", content: `正文-${index}` },
      {
        type: "tool",
        stepId: `r:${index + 2}`,
        webSearch: {
          callId: String(index), tool: "show_images", query: "图片", status: "done", results: [],
          images: [{ id: String(index), title: "配图", url: `https://example.com/${index}.jpg` }],
        },
      },
    );
  }
  items.push({ type: "content", stepId: "r:4", phase: "answering", content: "结尾正文" });
  const html = render(message, items);
  expect(html.match(/正文-\d|图集-\d|结尾正文/g)).toEqual([
    "正文-0", "图集-0", "正文-1", "图集-1", "结尾正文",
  ]);
  expect(html).toContain('aria-expanded="false"');
});
