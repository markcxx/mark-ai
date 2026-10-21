import { describe, expect, it } from "vitest";
import { prepareRequestHistory } from "./request-history";

describe("model request history", () => {
  it("recovers subsequent turns after repeated failed APDL replies without changing saved messages", () => {
    const messages = [
      { role: "user", content: "用 pipe288 建管子" },
      { role: "model", content: "已有命令流" },
      { role: "user", content: "法兰空出来" },
      { role: "model", content: "", reasoning: "只完成思考", interrupted: true },
      { role: "user", content: "EL 指的是 Z 轴吧" },
      {
        role: "model",
        content: "",
        segments: [{ type: "error", content: "assistant must not be empty" }],
      },
      { role: "user", content: "不要建坡度" },
      { role: "model", content: "   ", interrupted: true },
      { role: "user", content: "按真实弯头曲率建模" },
    ];
    const before = JSON.stringify(messages);
    const result = prepareRequestHistory(messages);
    expect(result).toEqual([
      messages[0],
      messages[1],
      messages[2],
      messages[4],
      messages[6],
      messages[8],
    ]);
    expect(JSON.stringify(messages)).toBe(before);
  });

  it("retains interrupted partial answers and attachment-only user messages", () => {
    const messages = [
      { role: "user", content: "", attachments: [{ id: "drawing" }] },
      { role: "model", content: "部分有效答案", interrupted: true },
      { role: "assistant", content: "", reasoning: "reasoning-only" },
      { role: "user", content: "继续" },
    ];
    expect(prepareRequestHistory(messages)).toEqual([messages[0], messages[1], messages[3]]);
  });
});
