import { describe, expect, it } from "vitest";

import type { Message } from "@/lib/chat/types";

import { resolveAgentAvatarMode } from "./agent-avatar";

const modelMessage = (overrides: Partial<Message> = {}): Message => ({
  content: "",
  id: "model-1",
  role: "model",
  ...overrides,
});

describe("resolveAgentAvatarMode", () => {
  it("keeps the latest completed assistant message ambient", () => {
    expect(resolveAgentAvatarMode(modelMessage({ content: "完成" }), true)).toEqual({
      ambient: true,
      animate: true,
      state: "idle",
    });
  });

  it("freezes older completed assistant messages", () => {
    expect(resolveAgentAvatarMode(modelMessage({ content: "旧回答" }), false)).toEqual({
      ambient: false,
      animate: false,
      state: "idle",
    });
  });

  it("uses task states before ambient animation", () => {
    const searching = modelMessage({
      isStreaming: true,
      segments: [
        {
          type: "tool",
          webSearch: { query: "MarkAI", results: [], status: "searching" },
        },
      ],
    });
    expect(resolveAgentAvatarMode(searching, true).state).toBe("orbit");
  });

  it("uses a curious face instead of turning the avatar into thinking dots", () => {
    expect(
      resolveAgentAvatarMode(modelMessage({ isReasoning: true, isStreaming: true }), true),
    ).toEqual({
      ambient: false,
      animate: true,
      expression: "curieux",
      state: "idle",
    });
  });

  it("settles an interrupted tail message after the alert animation", () => {
    expect(
      resolveAgentAvatarMode(modelMessage({ content: "生成失败", interrupted: true }), true, false, false),
    ).toEqual({ ambient: true, animate: true, state: "idle" });
  });

  it("stops ambient animation when a user message becomes the tail", () => {
    expect(resolveAgentAvatarMode(modelMessage({ content: "完成" }), false).ambient).toBe(false);
  });
});
