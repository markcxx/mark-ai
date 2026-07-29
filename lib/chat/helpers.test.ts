import { describe, expect, it } from "vitest";

import { getMessageContentForModel } from "./helpers";

describe("getMessageContentForModel", () => {
  it("keeps ordinary message content unchanged", () => {
    expect(getMessageContentForModel({ content: "继续说明", id: "message-1", role: "user" })).toBe(
      "继续说明",
    );
  });

  it("includes quoted text before the user's question", () => {
    expect(
      getMessageContentForModel({
        content: "这是什么意思？",
        id: "message-2",
        role: "user",
        segments: [{ content: "被引用的回答", sourceMessageId: "message-1", type: "quote" }],
      }),
    ).toBe("[引用内容]\n被引用的回答\n[/引用内容]\n\n这是什么意思？");
  });
});
