import { describe, expect, it } from "vitest";

import { resolveSpeechConfig } from "./speech";

describe("resolveSpeechConfig", () => {
  it("uses the dedicated TTS API key", () => {
    const config = resolveSpeechConfig({
      MARKAI_TTS_API_KEY: "test-key",
      MARKAI_TTS_PROVIDER: "markbailian",
    });

    expect(config.apiKey).toBe("test-key");
    expect(config.model).toBe("qwen3-tts-flash");
    expect(config.voice).toBe("Cherry");
  });

  it("accepts a complete compatible speech endpoint", () => {
    const config = resolveSpeechConfig({
      MARKAI_TTS_API_KEY: "test-key",
      MARKAI_TTS_BASE_URL: "https://speech.example.com/api/v1/generation",
      MARKAI_TTS_PROVIDER: "custom",
    });

    expect(config.baseUrl).toBe("https://speech.example.com/api/v1/generation");
  });

  it("rejects a provider without the dedicated TTS API key", () => {
    expect(() => resolveSpeechConfig({ MARKAI_TTS_PROVIDER: "markbailian" })).toThrow(
      "未配置 MARKAI_TTS_API_KEY",
    );
  });
});
