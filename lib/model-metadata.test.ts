import { describe, expect, it } from "vitest";

import { getModelMetadata, hasKnownContextWindow } from "./model-metadata";

const configuredModelExpectations = [
  ["gpt-5-5", "gpt-5.5", 1_050_000, true],
  ["gpt-5-3", "gpt-5.3-chat-latest", 128_000, true],
  ["qwen3.7-plus", "qwen3.7-plus", 1_000_000, true],
  ["qwen3.7-max-preview", "qwen3.7-max", 1_000_000, true],
  ["qwen3.6-max-preview", "qwen3.6-max-preview", 262_144, false],
  ["qwen3.6-plus", "qwen3.6-plus", 1_000_000, true],
  ["qwen3.6-flash", "qwen3.6-flash", 1_000_000, true],
  ["deepseek-ai/DeepSeek-V4-Pro", "deepseek-v4-pro", 1_048_576, false],
  ["deepseek-ai/DeepSeek-V4-Flash", "deepseek-v4-flash", 1_048_576, false],
  ["deepseek-ai/DeepSeek-V3.2", "deepseek-v3.2", 163_840, false],
  ["deepseek-ai/DeepSeek-R1", "deepseek-r1", 131_072, false],
  ["Qwen/Qwen3-Coder-Next", "qwen3-coder-next", 262_144, false],
  ["moonshotai/Kimi-K2.7-Code", "kimi-k2.7-code", 262_144, true],
  ["openai/gpt-oss-120b", "gpt-oss-120b", 131_072, false],
] as const;

describe("model metadata", () => {
  it.each(configuredModelExpectations)(
    "resolves configured model %s",
    (configuredId, metadataId, contextWindowTokens, supportsVision) => {
      const metadata = getModelMetadata(configuredId);

      expect(metadata).toMatchObject({
        contextWindowTokens,
        id: metadataId,
      });
      expect(Boolean(metadata?.supportsVision)).toBe(supportsVision);
    },
  );

  it("keeps undocumented internal model limits unknown", () => {
    const metadata = getModelMetadata("gpt-5-3-mini");

    expect(metadata?.id).toBe("gpt-5-3-mini");
    expect(hasKnownContextWindow(metadata)).toBe(false);
    expect(metadata?.supportsToolCalling).toBeUndefined();
    expect(metadata?.supportsVision).toBeUndefined();
  });

  it("does not merge distinct model variants through aliases", () => {
    expect(getModelMetadata("deepseek-ai/DeepSeek-V4-Pro")?.displayName).toBe(
      "DeepSeek V4 Pro",
    );
    expect(getModelMetadata("zai-org/GLM-4.7-Flash")?.displayName).toBe("GLM-4.7 Flash");
  });
});
