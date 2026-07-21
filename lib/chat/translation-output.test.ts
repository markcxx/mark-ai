import { describe, expect, it } from "vitest";

import { extractTranslation } from "./translation-output";

describe("extractTranslation", () => {
  it("extracts the tagged payload without surrounding commentary", () => {
    expect(extractTranslation("说明<translation>完整译文</translation>尾注")).toBe("完整译文");
  });

  it("removes common markdown fences and labels", () => {
    expect(extractTranslation("```markdown\n翻译：**你好**\n```")).toBe("**你好**");
  });
});
