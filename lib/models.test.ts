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
