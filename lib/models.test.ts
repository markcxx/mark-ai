import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findConfiguredModel, getPublicConfiguredModels } from "./models";

const TEST_ENV_KEYS = [
  "AI_MODEL_CONFIGS",
  "AI_PROVIDERS",
  "MARKCHANNELA_API_KEY",
  "MARKCHANNELA_BASE_URL",
  "MARKCHANNELA_MODELS",
  "MARKCHANNELB_API_KEY",
  "MARKCHANNELB_BASE_URL",
  "MARKCHANNELB_MODELS",
  "MARKCHANNELA_EXTRA_API_KEY",
  "MARKCHANNELA_EXTRA_BASE_URL",
  "MARKCHANNELA_EXTRA_MODELS",
] as const;

const originalEnvironment = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of TEST_ENV_KEYS) {
    originalEnvironment.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of TEST_ENV_KEYS) {
    const value = originalEnvironment.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  originalEnvironment.clear();
});

describe("MarkAI model channels", () => {
  it("selects Messages only for Claude in a mixed CommandCode channel", () => {
    process.env.AI_PROVIDERS = "markchannela";
    process.env.MARKCHANNELA_API_KEY = "test-key";
    process.env.MARKCHANNELA_BASE_URL = "https://api.commandcode.ai/provider/v1";
    process.env.MARKCHANNELA_MODELS = "claude-haiku-5-5,gpt-6-luna";
    expect(findConfiguredModel("claude-haiku-5-5", "markchannela")?.runtime).toBe("anthropic");
    expect(findConfiguredModel("gpt-6-luna", "markchannela")?.runtime).toBe("openai-compatible");
  });
  it("auto-discovers an isolated channel without sharing its key pool with the original channel", () => {
    process.env.MARKCHANNELA_API_KEY = "key-one,key-two";
    process.env.MARKCHANNELA_BASE_URL = "https://channel.example/v1";
    process.env.MARKCHANNELA_MODELS = "existing-only";
    process.env.MARKCHANNELA_EXTRA_API_KEY = "key-one";
    process.env.MARKCHANNELA_EXTRA_BASE_URL = "https://channel.example/v1";
    process.env.MARKCHANNELA_EXTRA_MODELS = "new-only";
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(findConfiguredModel("new-only", "markai")).toMatchObject({
      provider: "markchannela_extra",
      apiKey: "key-one",
    });
    expect(findConfiguredModel("existing-only", "markai")).toMatchObject({
      provider: "markchannela",
      apiKey: "key-two",
    });
    expect(getPublicConfiguredModels()).toContainEqual(
      expect.objectContaining({ provider: "markai", id: "new-only" }),
    );
  });
  it("routes an explicit thinking choice only to compatible channels", () => {
    process.env.AI_PROVIDERS = "markchannela,markchannelb";
    process.env.MARKCHANNELA_API_KEY = "test-a";
    process.env.MARKCHANNELA_BASE_URL = "https://unknown.example/v1";
    process.env.MARKCHANNELA_MODELS = "kimi-k2.5";
    process.env.MARKCHANNELB_API_KEY = "test-b";
    process.env.MARKCHANNELB_BASE_URL = "https://api.moonshot.cn/v1";
    process.env.MARKCHANNELB_MODELS = "kimi-k2.5";
    expect(
      getPublicConfiguredModels().find((m) => m.provider === "markai" && m.id === "kimi-k2.5")
        ?.thinking,
    ).toEqual({ defaultEnabled: true });
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(findConfiguredModel("kimi-k2.5", "markai")?.provider).toBe("markchannela");
    expect(findConfiguredModel("kimi-k2.5", "markai", true)?.provider).toBe("markchannelb");
    expect(findConfiguredModel("kimi-k2.5", "markchannela", true)).toBeUndefined();
  });
  it("publishes a shared model once and randomly resolves its configured channel", () => {
    process.env.AI_PROVIDERS = "markchannela,markchannelb";
    process.env.MARKCHANNELA_API_KEY = "channel-a-key";
    process.env.MARKCHANNELA_BASE_URL = "https://channel-a.example/v1";
    process.env.MARKCHANNELA_MODELS = "shared-model,channel-a-only";
    process.env.MARKCHANNELB_API_KEY = "channel-b-key";
    process.env.MARKCHANNELB_BASE_URL = "https://channel-b.example/v1";
    process.env.MARKCHANNELB_MODELS = "shared-model,channel-b-only";

    const sharedModels = getPublicConfiguredModels().filter(
      (model) => model.provider === "markai" && model.id === "shared-model",
    );
    expect(sharedModels).toHaveLength(1);

    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(findConfiguredModel("shared-model", "markai")?.baseUrl).toBe(
      "https://channel-a.example/v1",
    );

    vi.mocked(Math.random).mockReturnValue(0.999);
    expect(findConfiguredModel("shared-model", "markai")?.baseUrl).toBe(
      "https://channel-b.example/v1",
    );
  });
});
