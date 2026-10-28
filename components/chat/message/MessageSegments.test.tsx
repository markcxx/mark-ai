import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Message, MessageSegment } from "@/lib/chat/types";
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
  WebSearchToolBlockItem: () => <span>读取网页记录</span>,
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
