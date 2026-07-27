import { describe, expect, it } from "vitest";

import { getModelMetadata, hasKnownContextWindow } from "./model-metadata";

const configuredModelExpectations = [
  ["gpt-5.6-luna", "gpt-5.6-luna", 1_050_000, true],
  ["gpt-5.6-luna-低", "gpt-5.6-luna", 1_050_000, true],
  ["gpt-5.6-luna-中", "gpt-5.6-luna", 1_050_000, true],
  ["gpt-5.6-luna-高", "gpt-5.6-luna", 1_050_000, true],
  ["gpt-5.6-sol", "gpt-5.6-sol", 1_050_000, true],
  ["gpt-5.6-sol-低", "gpt-5.6-sol", 1_050_000, true],
  ["gpt-5.6-sol-中", "gpt-5.6-sol", 1_050_000, true],
  ["gpt-5.6-sol-高", "gpt-5.6-sol", 1_050_000, true],
  ["gpt-5.6-terra", "gpt-5.6-terra", 1_050_000, true],
  ["gpt-5.6-terra-低", "gpt-5.6-terra", 1_050_000, true],
  ["gpt-5.6-terra-中", "gpt-5.6-terra", 1_050_000, true],
  ["gpt-5.6-terra-高", "gpt-5.6-terra", 1_050_000, true],
  ["gpt-5-5", "gpt-5.5", 1_050_000, true],
  ["gpt-5-3", "gpt-5.3-chat-latest", 128_000, true],
  ["qwen3.7-plus", "qwen3.7-plus", 1_000_000, true],
  ["qwen3.7-max-preview", "qwen3.7-max", 1_000_000, true],
  ["qwen3.6-max-preview", "qwen3.6-max-preview", 262_144, false],
  ["qwen3.6-plus", "qwen3.6-plus", 1_000_000, true],
  ["qwen3.6-flash", "qwen3.6-flash", 1_000_000, true],
  ["qwen3.6-27b", "qwen3.6-27b", 262_144, true],
  ["qwen3.5-flash", "qwen3.5-flash", 1_000_000, true],
  ["qwen3-vl-flash", "qwen3-vl-flash", 262_144, true],
  ["qwen3-coder-plus", "qwen3-coder-plus", 1_000_000, false],
  ["qwen3-32b", "qwen3-32b", 131_072, false],
  ["qwen-turbo", "qwen-turbo", 131_072, false],
  ["deepseek-ai/DeepSeek-V4-Pro", "deepseek-v4-pro", 1_048_576, false],
  ["deepseek-ai/DeepSeek-V4-Flash", "deepseek-v4-flash", 1_048_576, false],
  ["deepseek-v4-pro-260425", "deepseek-v4-pro", 1_048_576, false],
  ["deepseek-v4-flash-260425", "deepseek-v4-flash", 1_048_576, false],
  ["deepseek-ai/DeepSeek-V3.2", "deepseek-v3.2", 163_840, false],
  ["deepseek-v3", "deepseek-v3", 131_072, false],
  ["deepseek-ai/DeepSeek-R1", "deepseek-r1", 131_072, false],
  ["Qwen/Qwen3-Coder-Next", "qwen3-coder-next", 262_144, false],
  ["moonshotai/Kimi-K2.7-Code", "kimi-k2.7-code", 262_144, true],
  ["kimi-k2.7-code-highspeed", "kimi-k2.7-code", 262_144, true],
  ["kimi-k2-250711", "kimi-k2-0711-preview", 131_072, false],
  ["kimi-k2-250905", "kimi-k2-0905-preview", 262_144, false],
  ["kimi-k2-thinking-251104", "kimi-k2-thinking", 262_144, false],
  ["kimi-k3", "kimi-k3", 1_000_000, true],
  ["doubao-seed-1-6-250615", "doubao-seed-1.6", 256_000, true],
  ["doubao-seed-1-6-flash-250615", "doubao-seed-1.6-flash", 256_000, false],
  ["doubao-seed-2-0-lite-260215", "doubao-seed-2.0-lite", 256_000, false],
  ["doubao-seed-2-0-mini-260215", "doubao-seed-2.0-mini", 256_000, false],
  ["doubao-1.5-vision-pro", "doubao-1.5-vision-pro-32k", 32_768, true],
  ["glm-5-2-260617", "glm-5.2", 1_000_000, false],
  ["glm-4.6v", "glm-4.6v", 131_072, true],
  ["glm-4.5v", "glm-4.5v", 65_536, true],
  ["models/gemini-3.5-flash-lite", "gemini-3.5-flash-lite", 1_048_576, true],
  ["models/gemini-3.6-flash", "gemini-3.6-flash", 1_048_576, true],
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
    expect(getModelMetadata("deepseek-ai/DeepSeek-V4-Pro")?.displayName).toBe("DeepSeek V4 Pro");
    expect(getModelMetadata("zai-org/GLM-4.7-Flash")?.displayName).toBe("GLM-4.7 Flash");
  });
});
