import { expect, it } from "vitest";
import { normalizeModelRuntime, resolveModelRuntime } from "./model-runtime";
it.each(["anthropic", "anthropic-messages", "messages"])(
  "accepts the explicit Messages protocol %s",
  (runtime) => {
    expect(normalizeModelRuntime(runtime)).toBe("anthropic");
  },
);
it("routes only Claude models on the mixed CommandCode gateway to Messages", () => {
  const base = { runtime: "openai-compatible", baseUrl: "https://api.commandcode.ai/provider/v1" };
  expect(resolveModelRuntime({ ...base, id: "claude-haiku-5-5" })).toBe("anthropic");
  expect(resolveModelRuntime({ ...base, id: "anthropic/claude-opus-5" })).toBe("anthropic");
  expect(resolveModelRuntime({ ...base, id: "gpt-6-luna" })).toBe("openai-compatible");
  expect(resolveModelRuntime({ ...base, id: "xiaomi/mimo-v2.5" })).toBe("openai-compatible");
  expect(
    resolveModelRuntime({ ...base, baseUrl: "https://another.example/v1", id: "claude-haiku-5-5" }),
  ).toBe("openai-compatible");
});
it("honors an explicitly selected Messages protocol for other hosts and models", () => {
  expect(
    resolveModelRuntime({
      id: "custom-model",
      baseUrl: "https://custom.example/v1",
      runtime: "anthropic",
    }),
  ).toBe("anthropic");
});
