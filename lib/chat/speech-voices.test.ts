import { describe, expect, it } from "vitest";

import { isSpeechVoice, SPEECH_VOICES } from "./speech-voices";

describe("speech voice catalog", () => {
  it("contains unique supported voice values", () => {
    const values = SPEECH_VOICES.map((voice) => voice.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toHaveLength(48);
  });

  it("recognizes only catalog values", () => {
    expect(isSpeechVoice("Cherry")).toBe(true);
    expect(isSpeechVoice("custom-voice")).toBe(false);
  });
});
