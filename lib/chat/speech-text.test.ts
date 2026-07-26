import { describe, expect, it } from "vitest";

import { splitSpeechText } from "./speech-text";

describe("splitSpeechText", () => {
  it("keeps short text in one chunk", () => {
    expect(splitSpeechText("你好，欢迎使用 MarkAI。", 20)).toEqual(["你好，欢迎使用 MarkAI。"]);
  });

  it("prefers sentence boundaries without losing content", () => {
    const content = "第一句话很短。第二句话稍微长一点。第三句话结束。";
    const chunks = splitSpeechText(content, 14);

    expect(chunks.every((chunk) => Array.from(chunk).length <= 14)).toBe(true);
    expect(chunks.join("")).toBe(content);
  });

  it("counts emoji as one Unicode character", () => {
    expect(splitSpeechText("A😀B😀C", 3)).toEqual(["A😀B", "😀C"]);
  });
});
