import { describe, expect, it } from "vitest";

import { ThinkingTagStreamParser, type ThinkingTagStreamEvent } from "./thinking-tag-stream";

const parseChunks = (chunks: string[]) => {
  const parser = new ThinkingTagStreamParser();
  return [...chunks.flatMap((chunk) => parser.push(chunk)), ...parser.finish()].reduce(
    (result, event) => ({ ...result, [event.type]: result[event.type] + event.text }),
    { content: "", reasoning: "" } satisfies Record<ThinkingTagStreamEvent["type"], string>,
  );
};

describe("ThinkingTagStreamParser", () => {
  it("separates embedded reasoning from visible content", () => {
    expect(parseChunks(["回答前", "<think>分析</think>", "回答后"])).toEqual({
      content: "回答前回答后",
      reasoning: "分析",
    });
  });

  it("retains partial tags across arbitrary chunk boundaries", () => {
    expect(parseChunks(["可见<th", "ink>推", "理</thi", "nk>结论"])).toEqual({
      content: "可见结论",
      reasoning: "推理",
    });
  });

  it("supports unfinished reasoning", () => {
    expect(parseChunks(["<think>", "仍在思考"])).toEqual({
      content: "",
      reasoning: "仍在思考",
    });
  });
});
