import { describe, expect, it } from "vitest";

import { addTokenUsage, resolveTokenUsage } from "./token-usage";

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

  it("marks mixed accumulated usage as estimated", () => {
    const provider = resolveTokenUsage({
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      providerUsage: { inputTokens: 10, outputTokens: 5 },
    });
    const estimated = resolveTokenUsage({ estimatedInputTokens: 4, estimatedOutputTokens: 2 });
    expect(addTokenUsage(provider, estimated).tokenUsageSource).toBe("estimated");
  });
});
