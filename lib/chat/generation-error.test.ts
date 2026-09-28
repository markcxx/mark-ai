import { describe, expect, it } from "vitest";
import { describeGenerationError } from "./generation-error";
import { formatContextWindow, getModelMetadata } from "../model-metadata";

describe("generation error reporting", () => {
  it("explains Google's nested 503 error", () => {
    const result = describeGenerationError(
      new Error(
        JSON.stringify([
          {
            error: {
              code: 503,
              message: "This model is currently experiencing high demand.",
              status: "UNAVAILABLE",
            },
          },
        ]),
      ),
    );
    expect(result).toContain("This model is currently experiencing high demand.");
    expect(result).toContain("503");
  });
  it("preserves the exact unsupported-location reason", () => {
    const reason = "User location is not supported for the API use.";
    const error = Object.assign(
      new Error(
        JSON.stringify([{ error: { code: 400, message: reason, status: "FAILED_PRECONDITION" } }]),
      ),
      { status: 400 },
    );
    expect(describeGenerationError(error)).toBe(`生成失败：${reason}（400）`);
  });
  it("redacts credentials while retaining the provider explanation", () => {
    const error = {
      error: {
        code: 401,
        message:
          "Invalid API key: sk-secret. Bearer token-secret https://internal.invalid/?key=secret custom-value",
      },
    };
    const result = describeGenerationError(error, ["custom-value"]);
    expect(result).toContain("Invalid API key");
    expect(result).not.toMatch(/sk-secret|token-secret|internal.invalid|custom-value/);
  });
  it.each([
    [429, "限流"],
    [401, "认证"],
    [404, "不存在"],
    [500, "内部错误"],
  ])("explains HTTP %s", (status, text) => {
    expect(describeGenerationError(Object.assign(new Error(""), { status }))).toContain(text);
  });
  it("does not expose an unknown provider body or credentials", () => {
    expect(
      describeGenerationError(new Error("debug secret=private-value https://private.invalid")),
    ).not.toMatch(/private/);
  });
});

it("uses conventional integer context labels without changing limits", () => {
  for (const [tokens, label] of [
    [1050000, "1M"],
    [1048576, "1M"],
    [131072, "128K"],
    [32768, "32K"],
    [128000, "128K"],
  ] as const)
    expect(formatContextWindow(tokens)).toBe(label);
  for (const id of ["gpt-6-sol", "gpt-6-luna", "gemini-3.8-flash"])
    expect(getModelMetadata(id)?.contextWindowTokens).toBeGreaterThan(1000000);
});
