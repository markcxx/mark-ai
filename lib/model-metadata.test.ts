import { describe, expect, it } from "vitest";

import {
  formatModelMetadataDetails,
  getModelMetadata,
  hasKnownContextWindow,
} from "./model-metadata";

const configuredModelExpectations = [
  ["glm-5.3-prime", "glm-5.3-prime", 1_000_000, false],
  ["glm-5.2-fast-preview", "glm-5.2-fast-preview", 1_000_000, false],
  ["qwen3.8-27b", "qwen3.8-27b", 1_000_000, true],
  ["qwen3.8-2.4t-a95b", "qwen3.8-2.4t-a95b", 1_000_000, false],
  ["qwen3.7-flash", "qwen3.7-flash", 1_000_000, true],
  ["qwen3.7-flash-2026-07-15", "qwen3.7-flash", 1_000_000, true],
  ["qwen3-coder-flash", "qwen3-coder-flash", 1_000_000, false],
  ["xiaomi/mimo-v2.6-pro", "mimo-v2.6-pro", 1_048_576, true],
  ["xiaomi/mimo-v2.6-flash", "mimo-v2.6-flash", 1_048_576, true],
  ["minimax/minimax-m3.1-flash", "minimax-m3.1-flash", 1_000_000, true],
  ["claude-haiku-5-5", "claude-haiku-5-5", 1_000_000, true],
  ["grok-4.7", "grok-4.7", 500_000, true],
  ["xai/grok-4.7", "grok-4.7", 500_000, true],
  ["xai/grok-4.7-latest", "grok-4.7", 500_000, true],
  ["xai/grok-4.6", "grok-4.6", 500_000, true],
  ["xai/grok-4.5", "grok-4.5", 500_000, true],
  ["xiaomi/mimo-v2.5-pro", "mimo-v2.5-pro", 1_000_000, false],
  ["xiaomi/mimo-v2.5", "mimo-v2.5", 1_000_000, true],
  ["qwen3.8-max-preview", "qwen3.8-max-preview", 1_000_000, true],
  ["gemini-3-flash-preview", "gemini-3-flash-preview", 1_048_576, true],
  ["gemini-3.1-flash-lite", "gemini-3.1-flash-lite", 1_048_576, true],
  ["gemini-2.5-flash", "gemini-2.5-flash", 1_048_576, true],
  ["gpt-6-sol-高", "gpt-6-sol", 1_050_000, true],
  ["gpt-6-sol-中", "gpt-6-sol", 1_050_000, true],
  ["gpt-6-sol-低", "gpt-6-sol", 1_050_000, true],
  ["gpt-6-luna-高", "gpt-6-luna", 1_050_000, true],
  ["gpt-6-luna-中", "gpt-6-luna", 1_050_000, true],
  ["gpt-6-luna-低", "gpt-6-luna", 1_050_000, true],
  ["gemini-3.7-flash", "gemini-3.7-flash", 1_048_576, true],
  ["gemini-3.8-flash", "gemini-3.8-flash", 1_048_576, true],
  ["qwen3.8-flash", "qwen3.8-flash", 1_000_000, true],
  ["qwen3.8-max", "qwen3.8-max", 1_000_000, true],
  ["qwen3.8-max-0902", "qwen3.8-max", 1_000_000, true],
  ["deepseek-flash", "deepseek-v4.1-flash", 1_048_576, true],
  ["deepseek-v4-1-flash-260910", "deepseek-v4-1-flash-260910", 1_048_576, true],
  ["deepseek-v4-1-flash-261017", "deepseek-v4-1-flash-261017", 1_048_576, true],
  ["doubao-seed-2-1-lite-260915", "doubao-seed-2.1-lite", 1_048_576, true],
  ["XiaomiMiMo/MiMo-V2.5", "mimo-v2.5", 1_000_000, true],
  ["zai-org/GLM-5.3", "glm-5.3", 1_000_000, false],
  ["glm-5.3", "glm-5.3", 1_000_000, false],
  ["zai-org/GLM-5.3-Flash", "glm-5.3-flash", 1_000_000, true],
  ["glm-5.3-flash", "glm-5.3-flash", 1_000_000, true],
  ["deepseek-ai/DeepSeek-V4.1-Flash", "deepseek-v4.1-flash", 1_048_576, true],
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
  ["deepseek-v4-flash-ga-260731", "deepseek-v4-flash-ga-260731", 1_048_576, false],
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

it("recognizes Astra without assigning its limits to unverified GPT-6 identifiers", () => {
  expect(getModelMetadata("openai/gpt-6-astra")?.contextWindowTokens).toBe(1_050_000);
  expect(getModelMetadata("gpt-6-astra-高")?.maxOutputTokens).toBe(128_000);
  expect(getModelMetadata("gpt-6")?.contextWindowTokens).toBeUndefined();
  expect(getModelMetadata("gpt-6-mini")).toBeUndefined();
});

it("keeps new model output limits and capabilities distinct", () => {
  for (const id of ["glm-5.3", "glm-5.3-flash"]) {
    expect(getModelMetadata(id)).toMatchObject({
      maxOutputTokens: 131_072,
      supportsReasoning: true,
      supportsToolCalling: true,
    });
  }
  expect(getModelMetadata("glm-5.3-flash")?.supportsVideo).toBe(true);
  expect(getModelMetadata("deepseek-ai/DeepSeek-V4.1-Flash")).toMatchObject({
    maxOutputTokens: 393_216,
    supportsReasoning: true,
    supportsToolCalling: true,
    supportsVision: true,
  });
  expect(getModelMetadata("glm-5.3-unknown")).toBeUndefined();
});

it("does not infer specifications for custom or undocumented model variants", () => {
  expect(getModelMetadata("mimo-v2.6-pro-custom")).toBeUndefined();
  expect(getModelMetadata("minimax-m3.1-flash-preview")).toBeUndefined();
  expect(getModelMetadata("gpt-6-sol-custom")).toBeUndefined();
});

it("preserves distinct generation budgets for new gateway models", () => {
  expect(getModelMetadata("xiaomi/mimo-v2.6-pro")?.maxOutputTokens).toBe(131_072);
  expect(getModelMetadata("xiaomi/mimo-v2.6-flash")?.maxOutputTokens).toBe(131_072);
  expect(getModelMetadata("minimax/minimax-m3.1-flash")?.maxOutputTokens).toBe(524_288);
  expect(getModelMetadata("claude-haiku-5-5")?.maxOutputTokens).toBe(128_000);
  expect(getModelMetadata("xai/grok-4.6")?.maxOutputTokens).toBeUndefined();
  expect(getModelMetadata("xai/grok-4.5")?.maxOutputTokens).toBeUndefined();
  expect(getModelMetadata("xai/grok-4.7")?.maxOutputTokens).toBeUndefined();
  expect(getModelMetadata("xai/grok-4.7")).toMatchObject({
    knowledgeCutoff: "2026-05",
    supportsReasoning: true,
    supportsToolCalling: true,
    supportsVideo: false,
  });
});

it("shows exact limits and capabilities while keeping unpublished values explicit", () => {
  const metadata = getModelMetadata("minimax/minimax-m3.1-flash")!;
  const details = formatModelMetadataDetails(metadata);
  expect(details).toContain(`上下文 ${metadata.contextWindowTokens!.toLocaleString()} tokens`);
  expect(details).toContain(`最大输出 ${metadata.maxOutputTokens!.toLocaleString()} tokens`);
  expect(details).toContain("支持视频理解");
  expect(details).toContain("支持工具调用");
  expect(details).toContain("知识截止暂未公布");
  const grokDetails = formatModelMetadataDetails(getModelMetadata("xai/grok-4.6")!);
  expect(grokDetails).toContain("最大输出暂未核实");
  expect(grokDetails).not.toContain("支持视频理解");
  const unknownDetails = formatModelMetadataDetails(getModelMetadata("gpt-6")!);
  expect(unknownDetails).toContain("上下文暂未核实");
  expect(unknownDetails).not.toContain("支持图像理解");
});
