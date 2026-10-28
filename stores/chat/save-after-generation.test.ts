import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatStore } from "../useChatStore";
import { useSessionStore } from "../useSessionStore";
import { forgetPendingSession, readPendingSession } from "@/lib/chat/client/pending-session";
import type { ChatSession } from "@/lib/chat/types";

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("../useUIStore", () => ({
  useUIStore: {
    getState: () => ({
      availableModels: [{ id: "model", provider: "provider" }],
      selectedModelKey: "provider:model",
      webSearchEnabled: false,
    }),
  },
}));
vi.mock("../useSettingsStore", () => ({ useSettingsStore: { getState: () => ({ general: {} }) } }));
vi.mock("../useToolStore", () => ({ useToolStore: { getState: () => ({}) } }));
vi.mock("./stream-assistant-message", () => ({ createStreamAssistantMessage: () => vi.fn() }));
const session = {
  id: "save-test",
  revision: 1,
  title: "test",
  createdAt: 1,
  updatedAt: 1,
} as ChatSession;
beforeEach(() => {
  useSessionStore.setState({ sessions: [session], activeSessionId: session.id });
  useChatStore.setState({
    messages: [],
    input: "你好",
    isLoading: false,
    pendingAttachments: [],
    pendingQuote: null,
    queuedMessage: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  forgetPendingSession(session.id);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["complete", "abort", "error", "navigate"])(
  "starts generation without a history PUT and saves once after %s",
  async (kind) => {
    let finish!: (value: { content: string; isStreaming: boolean; interrupted: boolean }) => void;
    const stream = vi.fn(
      () =>
        new Promise<{ content: string; isStreaming: boolean; interrupted: boolean }>((resolve) => {
          finish = resolve;
        }),
    );
    useChatStore.setState({ streamAssistantMessage: stream });
    const fetcher = vi.fn(async () => Response.json({ session: { ...session, revision: 2 } }));
    vi.stubGlobal("fetch", fetcher);
    const run = useChatStore.getState().sendMessage();
    expect(stream).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
    expect(readPendingSession(session.id)?.messages[0].content).toBe("你好");
    if (kind === "navigate") {
      useSessionStore.setState({ activeSessionId: "elsewhere" });
      useChatStore.setState({ messages: [{ id: "other", role: "user", content: "其他会话" }] });
    }
    finish({ content: "已输出内容", isStreaming: false, interrupted: kind !== "complete" });
    await run;
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/sessions/${session.id}/messages`);
    expect(JSON.parse(options.body as string).messages.at(-1).content).toBe("已输出内容");
    expect(readPendingSession(session.id)).toBeUndefined();
    if (kind === "navigate") expect(useChatStore.getState().messages[0].content).toBe("其他会话");
  },
);
it("keeps a recoverable completed answer when the final save fails", async () => {
  useChatStore.setState({
    streamAssistantMessage: vi.fn(async () => ({ content: "完整回答", isStreaming: false })),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("offline", { status: 503 })),
  );
  await useChatStore.getState().sendMessage();
  expect(useChatStore.getState().messages.at(-1)?.content).toBe("完整回答");
  expect(readPendingSession(session.id)?.messages.at(-1)?.content).toBe("完整回答");
});
