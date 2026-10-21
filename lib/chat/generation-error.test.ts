import { describe, expect, it, vi } from "vitest";
import { describeGenerationError, readProviderResponseError } from "./generation-error";
import { formatContextWindow, getModelMetadata } from "../model-metadata";

describe("raw generation error reporting", () => {
  it("preserves a failed HTTP response body and redacts the configured key", async () => {
    const raw = JSON.stringify({
      error: { message: "schema failed", debug: "configured-key", request_id: "req-2" },
    });
    const error = await readProviderResponseError(new Response(raw, { status: 422 }), [
      "configured-key",
    ]);
    expect(describeGenerationError(error)).toBe(
      `HTTP 422\n${raw.replace("configured-key", "[已隐藏]")}`,
    );
  });

  it.each([400, 401, 402, 403, 404, 422, 429, 500, 503])(
    "preserves HTTP %s and the complete upstream JSON",
    (status) => {
      const raw = JSON.stringify({
        error: {
          code: "provider_error",
          message: "Original upstream reason",
          request_id: "req-test",
        },
      });
      const error = Object.assign(new Error(raw), { status });
      expect(describeGenerationError(error)).toBe(`HTTP ${status}\n${raw}`);
    },
  );
  it("preserves nested provider errors without extracting only the message", () => {
    const raw = JSON.stringify([
      {
        error: {
          code: 503,
          message: "This model is currently experiencing high demand.",
          status: "UNAVAILABLE",
        },
      },
    ]);
    expect(describeGenerationError(new Error(raw))).toBe(`HTTP 503\n${raw}`);
  });
  it.each([
    "insufficient permissions",
    "quota exceeded",
    "fetch failed",
    "some unrecognized reason",
    "<html>Bad gateway</html>",
  ])("does not rewrite plain text: %s", (raw) => {
    expect(describeGenerationError(new Error(raw))).toBe(raw);
  });
  it("preserves multiline and long errors without truncating diagnostic details", () => {
    const raw = "First line\n" + "x".repeat(2000) + "\nrequest-id=last";
    expect(describeGenerationError(new Error(raw))).toBe(raw);
  });
  it("redacts credentials but retains URLs and diagnostic fields", () => {
    const raw = JSON.stringify({
      error: {
        message:
          "Invalid API key: sk-secret Bearer token-secret custom-value https://provider.invalid/endpoint?key=private",
        api_key: "unusual-key",
        request_id: "req-1",
      },
    });
    const result = describeGenerationError(new Error(raw), ["custom-value"]);
    expect(result).toContain("Invalid API key");
    expect(result).toContain("https://provider.invalid/endpoint");
    expect(result).toContain("req-1");
    expect(result).not.toMatch(/sk-secret|token-secret|custom-value|unusual-key|private/);
  });
  it("does the same in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(
        describeGenerationError(
          Object.assign(new Error("tool_choice unsupported"), { status: 400 }),
        ),
      ).toBe("HTTP 400\ntool_choice unsupported");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("retains a status when no upstream body was provided", () => {
    expect(describeGenerationError(Object.assign(new Error(""), { status: 402 }))).toBe("HTTP 402");
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
