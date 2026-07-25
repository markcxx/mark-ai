import { describe, expect, it } from "vitest";

import {
  compareModelProviders,
  getModelFamilyKey,
  isMarkAIProvider,
  sortModelsByFamily,
} from "./model-sorting";

const model = (id: string, provider = "markai") => ({ id, provider });

describe("model selection sorting", () => {
  it("recognizes every MARK-prefixed provider and places it first", () => {
    expect(isMarkAIProvider("markai")).toBe(true);
    expect(isMarkAIProvider("MARKDOUBAO")).toBe(true);
    expect(isMarkAIProvider("markdeepseek")).toBe(true);
    expect(["deepseek", "markai", "gemini"].sort(compareModelProviders)).toEqual([
      "markai",
      "deepseek",
      "gemini",
    ]);
  });

  it("keeps model families together and sorts newer versions first", () => {
    const sorted = sortModelsByFamily([
      model("deepseek-v3.1"),
      model("doubao-seed-1.6-pro"),
      model("deepseek-v4-flash"),
      model("doubao-seed-2.1-turbo"),
      model("deepseek-v4-pro"),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "deepseek-v3.1",
      "doubao-seed-2.1-turbo",
      "doubao-seed-1.6-pro",
    ]);
  });

  it("sorts parameter counts from large to small within the same version", () => {
    const sorted = sortModelsByFamily([
      model("Qwen/Qwen3-32B"),
      model("Qwen/Qwen3-235B-A22B"),
      model("Qwen/Qwen3-72B"),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "Qwen/Qwen3-235B-A22B",
      "Qwen/Qwen3-72B",
      "Qwen/Qwen3-32B",
    ]);
  });

  it("recognizes common model families independently of path prefixes", () => {
    expect(getModelFamilyKey("deepseek-ai/DeepSeek-V4-Pro")).toBe("deepseek");
    expect(getModelFamilyKey("volcengine/Doubao-Seed-2.1-Pro")).toBe("doubao");
    expect(getModelFamilyKey("openai/gpt-5.5")).toBe("gpt");
  });
});
