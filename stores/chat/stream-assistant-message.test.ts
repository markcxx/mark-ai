import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ChatStore } from "../useChatStore";
import type { ChatStreamEvent, Message } from "@/lib/chat/types";
import { createStreamAssistantMessage } from "./stream-assistant-message";
import { getExecutionTrace } from "@/lib/chat/execution-trace";

const mocks = vi.hoisted(() => ({
  activeSessionId: "session-a",
  animation: "smooth",
  status: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("react-hot-toast", () => ({ default: mocks.toast }));
vi.mock("@/stores/useSettingsStore", () => ({
  useSettingsStore: { getState: () => ({ general: { responseAnimation: mocks.animation } }) },
}));
vi.mock("@/stores/useSessionStore", () => ({
  useSessionStore: {
    getState: () => ({
      activeSessionId: mocks.activeSessionId,
      setSessionGenerationStatus: mocks.status,
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeSessionId = "session-a";
  mocks.animation = "smooth";
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup() {
  let state = {
    messages: [{ id: "m", role: "model", content: "", isStreaming: true }] as Message[],
  } as ChatStore;
  const get = () => state;
  const set = ((update: Partial<ChatStore> | ((s: ChatStore) => Partial<ChatStore>)) => {
    state = { ...state, ...(typeof update === "function" ? update(state) : update) };
  }) as Parameters<typeof createStreamAssistantMessage>[0];
  let writer!: ReadableStreamDefaultController<Uint8Array>;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (_url, options) =>
        new Response(
          new ReadableStream({
            start(controller) {
              writer = controller;
              options.signal.addEventListener("abort", () =>
                controller.error(new DOMException("Stopped", "AbortError")),
              );
            },
          }),
          { headers: { "Content-Type": "application/x-ndjson" } },
        ),
    ),
  );
  const stream = createStreamAssistantMessage(set, get);
  const send = (...events: ChatStreamEvent[]) =>
    writer.enqueue(
      new TextEncoder().encode(events.map((event) => JSON.stringify(event)).join("\n") + "\n"),
    );
  return { get, set, send, close: () => writer.close(), stream };
}
const history: Message[] = [{ id: "u", role: "user", content: "搜索新闻" }];
const model = { id: "test", provider: "test" };
const tool: ChatStreamEvent = {
  type: "tool",
  webSearch: { callId: "t", query: "新闻", status: "done", results: [] },
};
const progress: ChatStreamEvent[] = [
  { type: "step", stepId: "run:1", status: "started" },
  { type: "content", text: "先查证。" },
  { type: "step", stepId: "run:1", status: "tool" },
  tool,
];
const final: ChatStreamEvent[] = [
  { type: "step", stepId: "run:2", status: "started" },
  { type: "content", text: "新闻结论" },
  { type: "complete", stepId: "run:2" },
];

it("flushes animation at step boundaries and persists progress separately from the final answer", async () => {
  const ctx = setup();
  const result = ctx.stream(history, "m", model, { sessionId: "session-a" });
  ctx.send(...progress, { type: "content", text: "```echarts\n{}\n```" }, ...final);
  ctx.close();
  const completed = await result;
  expect(completed.interrupted).not.toBe(true);
  expect(completed.segments?.filter((s) => s.type === "content").map((s) => s.phase)).toEqual([
    "progress",
    undefined,
    "answer",
  ]);
  expect(getExecutionTrace(JSON.parse(JSON.stringify(completed.segments))).canCollapse).toBe(true);
});

it.each(["eof", "error", "abort"])(
  "retains progress as interrupted on %s without treating it as a final answer",
  async (kind) => {
    const ctx = setup();
    const result = ctx.stream(history, "m", model, { sessionId: "session-a" });
    ctx.send(...progress, {
      type: "file",
      generatedFile: {
        callId: "file",
        toolId: "word-document",
        toolName: "word_document_begin",
        status: "running",
      },
    });
    await vi.waitFor(() => expect(ctx.get().messages[0].content).toBe("先查证。"));
    if (kind === "abort") ctx.get().abortController!.abort();
    else {
      if (kind === "error") ctx.send({ type: "error", text: "请求失败" });
      ctx.close();
    }
    const interrupted = await result;
    expect(interrupted.interrupted).toBe(true);
    expect(interrupted.content).toBe("先查证。");
    expect(getExecutionTrace(interrupted.segments!).canCollapse).toBe(false);
    expect(
      interrupted.segments?.find((segment) => segment.type === "generated-file"),
    ).toMatchObject({ generatedFile: { status: "error" } });
  },
);

it("returns the result for persistence without replacing another session's visible messages", async () => {
  const ctx = setup();
  const result = ctx.stream(history, "m", model, { sessionId: "session-a" });
  ctx.send(...progress);
  await vi.waitFor(() => expect(ctx.get().messages[0].content).toBe("先查证。"));
  mocks.activeSessionId = "session-b";
  ctx.set({ messages: [{ id: "other", role: "user", content: "另一会话" }] });
  ctx.send(...final);
  ctx.close();
  const completed = await result;
  expect(completed.content).toBe("先查证。新闻结论");
  expect(ctx.get().messages[0].content).toBe("另一会话");
});

it("preserves previous tool segments when continuing an interrupted answer", async () => {
  const ctx = setup();
  const initialSegments: Message["segments"] = [
    { type: "content", content: "旧进度", stepId: "old:1", phase: "progress" },
    { type: "tool", webSearch: tool.webSearch! },
  ];
  const result = ctx.stream(history, "m", model, {
    initialContent: "旧进度\n\n",
    initialSegments,
    sessionId: "session-a",
  });
  ctx.send(...final);
  ctx.close();
  const completed = await result;
  expect(completed.segments?.[0]).toEqual(initialSegments[0]);
  expect(completed.segments?.filter((s) => s.type === "tool")).toHaveLength(1);
  expect(completed.content).toBe("旧进度\n\n新闻结论");
});

it("enters the answer display phase on the first post-tool text, reopens for more tools, and still requires completion", async () => {
  mocks.animation = "none";
  const ctx = setup();
  const result = ctx.stream(history, "m", model, { sessionId: "session-a" });
  ctx.send(...progress, ...final.slice(0, 2));
  await vi.waitFor(() => expect(ctx.get().messages[0].content).toContain("新闻结论"));
  expect(ctx.get().messages[0].isStreaming).toBe(true);
  expect(getExecutionTrace(ctx.get().messages[0].segments!)).toMatchObject({
    answerStarted: true,
    canCollapse: false,
  });
  ctx.send(
    { type: "step", stepId: "run:2", status: "tool" },
    { ...tool, webSearch: { ...tool.webSearch!, callId: "next" } },
  );
  await vi.waitFor(() =>
    expect(getExecutionTrace(ctx.get().messages[0].segments!).answerStarted).toBe(false),
  );
  expect(ctx.get().messages[0].segments).toContainEqual(
    expect.objectContaining({ type: "content", content: "新闻结论", phase: "progress" }),
  );
  ctx.close();
  const interrupted = await result;
  expect(interrupted.interrupted).toBe(true);
});

it("preserves received text locally on pagehide and removes the listener after completion", async () => {
  const { recoverPendingMessages, forgetPendingSession } =
    await import("@/lib/chat/client/pending-session");
  const target = new EventTarget();
  const remove = vi.spyOn(target, "removeEventListener");
  vi.stubGlobal("window", target);
  const ctx = setup();
  const result = ctx.stream(history, "m", model, { sessionId: "session-a" });
  ctx.send(...progress, ...final);
  await vi.waitFor(() => expect(ctx.get().messages[0].content).toContain("先查证"));
  target.dispatchEvent(new Event("pagehide"));
  expect(recoverPendingMessages("session-a", 1)?.[0].content).toContain("新闻结论");
  ctx.close();
  await result;
  expect(remove).toHaveBeenCalledWith("pagehide", expect.any(Function));
  forgetPendingSession("session-a");
});
