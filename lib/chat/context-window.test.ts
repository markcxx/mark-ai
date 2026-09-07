import { describe, expect, it } from "vitest";

import type { ModelMetadataWithContext } from "@/lib/model-metadata";
import {
  estimateDraftContextTokens,
  getOutputReserveTokens,
  prepareMessagesForContext,
} from "./context-window";

const metadata: ModelMetadataWithContext = {
  contextWindowTokens: 4096,
  description: "测试模型",
  displayName: "Test",
  family: "test",
  id: "test",
  maxOutputTokens: 1024,
  sourceUrl: "https://example.com",
};

describe("context window preparation", () => {
  it("reserves no more than half of a small context window", () => {
    expect(getOutputReserveTokens(metadata)).toBe(1024);
  });

  it("drops older turns before truncating the newest message", () => {
    const messages = [
      { content: "旧问题".repeat(2000), role: "user" },
      { content: "旧回答".repeat(2000), role: "model" },
      { content: "新问题", role: "user" },
    ];
    const result = prepareMessagesForContext(messages, metadata, 256);

    expect(result.removedMessageCount).toBe(2);
    expect(result.messages).toEqual([{ content: "新问题", role: "user" }]);
    expect(result.estimatedInputTokens).toBeLessThanOrEqual(result.inputBudgetTokens + 256);
  });

  it("counts enabled tool context before the conversation starts", () => {
    expect(
      estimateDraftContextTokens({
        attachments: [],
        draft: "",
        messages: [],
        toolContextTokens: 4000,
        webSearchEnabled: false,
      }),
    ).toBe(4512);
  });
});

it("updates retained context after edits and excludes auxiliary output", () => {
  const base = { attachments: [], draft: "", webSearchEnabled: false };
  const message = { id: "u", role: "user" as const, content: "问题" };
  const initial = estimateDraftContextTokens({ ...base, messages: [message] });
  expect(
    estimateDraftContextTokens({ ...base, draft: "追加内容".repeat(100), messages: [message] }),
  ).toBeGreaterThan(initial);
  expect(estimateDraftContextTokens({ ...base, messages: [] })).toBe(0);
  expect(
    estimateDraftContextTokens({
      ...base,
      messages: [
        {
          ...message,
          totalTokens: 999999,
          reasoning: "思考".repeat(1000),
          segments: [{ type: "translation", language: "en", content: "translation".repeat(1000) }],
        },
      ],
    }),
  ).toBe(initial);
  expect(
    estimateDraftContextTokens({
      ...base,
      messages: [{ ...message, segments: [{ type: "quote", content: "引用".repeat(1000) }] }],
    }),
  ).toBeGreaterThan(initial);
});
