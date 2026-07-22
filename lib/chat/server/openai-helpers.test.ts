import { describe, expect, it } from "vitest";

import { toOpenAIMessages } from "./openai-helpers";

describe("toOpenAIMessages", () => {
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
