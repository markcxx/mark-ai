import { describe, expect, it } from "vitest";

import { detectGeneratedImageFormat, getOpenAIImageEndpoint } from "./image-runtime";

describe("getOpenAIImageEndpoint", () => {
  it("builds generation and edit endpoints from an API root", () => {
    expect(getOpenAIImageEndpoint("https://api.openai.com/v1/", "generations")).toBe(
      "https://api.openai.com/v1/images/generations",
    );
    expect(getOpenAIImageEndpoint("https://proxy.example/v1", "edits")).toBe(
      "https://proxy.example/v1/images/edits",
    );
  });

  it("normalizes a configured chat completions endpoint", () => {
    expect(getOpenAIImageEndpoint("https://proxy.example/v1/chat/completions", "edits")).toBe(
      "https://proxy.example/v1/images/edits",
    );
  });
});

describe("detectGeneratedImageFormat", () => {
  it("detects jpeg and webp and otherwise defaults to png", () => {
    expect(detectGeneratedImageFormat(new Uint8Array([0xff, 0xd8, 0xff]))).toEqual({
      contentType: "image/jpeg",
      extension: ".jpg",
    });
    expect(
      detectGeneratedImageFormat(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toEqual({ contentType: "image/webp", extension: ".webp" });
    expect(detectGeneratedImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({
      contentType: "image/png",
      extension: ".png",
    });
  });
});
