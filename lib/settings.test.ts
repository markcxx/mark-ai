import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, mergeSettings, sanitizeSpeechSettings } from "./settings";

describe("speech settings", () => {
  it("accepts a supported voice and rejects unknown values", () => {
    expect(sanitizeSpeechSettings({ voice: "Dylan" })).toEqual({ voice: "Dylan" });
    expect(sanitizeSpeechSettings({ voice: "unknown-voice" })).toEqual({
      voice: "__system__",
    });
  });

  it("merges speech preferences without changing other settings", () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, { speech: { voice: "Sunny" } });

    expect(settings.speech.voice).toBe("Sunny");
    expect(settings.general).toEqual(DEFAULT_SETTINGS.general);
    expect(settings.languageModel).toEqual(DEFAULT_SETTINGS.languageModel);
  });
});
