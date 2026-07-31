import { describe, expect, it } from "vitest";

import { getUsageNumber, resolveTokenUsage } from "./token-usage";

describe("token usage", () => {
  it("derives a missing provider field from the total", () => {
    expect(
      resolveTokenUsage({
        estimatedInputTokens: 100,
        estimatedOutputTokens: 20,
        providerUsage: { outputTokens: 30, totalTokens: 130 },
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 30,
      tokenUsageSource: "provider",
      totalTokens: 130,
    });
  });

  it("preserves the exact usage returned by an OpenAI-compatible provider", () => {
    expect(
      resolveTokenUsage({
        estimatedInputTokens: 400,
        estimatedOutputTokens: 200,
        providerUsage: { inputTokens: 1234, outputTokens: 567, totalTokens: 1801 },
      }),
    ).toEqual({
      inputTokens: 1234,
      outputTokens: 567,
      tokenUsageSource: "provider",
      totalTokens: 1801,
    });
  });

  it("uses estimates only when provider usage is absent", () => {
    expect(resolveTokenUsage({ estimatedInputTokens: 400, estimatedOutputTokens: 200 })).toEqual({
      inputTokens: 400,
      outputTokens: 200,
      tokenUsageSource: "estimated",
      totalTokens: 600,
    });
  });

  it("accepts numeric usage fields from compatible proxies", () => {
    expect(getUsageNumber(undefined, "1234")).toBe(1234);
  });
});
