import { describe, expect, it } from "vitest";
import {
  getThinkingPolicy,
  getThinkingRequestParameters,
  resolveThinkingEnabled,
} from "./model-thinking";

const route = (id: string, provider: string, baseUrl?: string) => ({
  id,
  provider,
  baseUrl,
  runtime: "openai-compatible",
});
describe("thinking capabilities and request dialects", () => {
  it("uses the hosting platform's dialect for the same Kimi model", () => {
    const direct = getThinkingPolicy(route("kimi-k2.5", "moonshot"));
    const hosted = getThinkingPolicy(route("kimi-k2.5", "bailian"));
    expect(getThinkingRequestParameters(direct, false)).toEqual({ thinking: { type: "disabled" } });
    expect(getThinkingRequestParameters(hosted, false)).toEqual({ enable_thinking: false });
    expect(direct?.defaultEnabled).toBe(true);
    expect(hosted?.defaultEnabled).toBe(false);
  });
  it.each([
    ["MiniMax-M2.5", "minimax"],
    ["glm-5.3", "zhipu"],
    ["glm-4-flash", "zhipu"],
    ["qwen3-235b-a22b-thinking-2507", "bailian"],
    ["qwen3-coder-plus", "bailian"],
    ["qwen3.7-max-preview", "bailian"],
    ["qwen-plus-2025-01-25", "bailian"],
    ["deepseek-r1", "siliconflow"],
    ["kimi-k2-thinking", "moonshot"],
    ["qwen3-32b", "unknown"],
  ])("does not advertise an unsupported switch for %s on %s", (id, provider) => {
    expect(getThinkingPolicy(route(id, provider))).toBeUndefined();
  });
  it("recognizes custom provider names by the actual endpoint", () => {
    expect(
      getThinkingPolicy(route("glm-4.7", "my-provider", "https://open.bigmodel.cn/api/paas/v4"))
        ?.defaultEnabled,
    ).toBe(true);
    expect(getThinkingPolicy({ ...route("glm-4.7", "zhipu"), runtime: "gemini" })).toBeUndefined();
  });
  it("recognizes Ark Seed hybrids but not old non-reasoning Doubao models", () => {
    const policy = getThinkingPolicy(
      route(
        "doubao-seed-2-0-lite-260428",
        "markdoubao_key1",
        "https://ark.cn-beijing.volces.com/api/v3",
      ),
    );
    expect(getThinkingRequestParameters(policy, false)).toEqual({ thinking: { type: "disabled" } });
    expect(getThinkingPolicy(route("doubao-1-5-pro-32k-250115", "volcengine"))).toBeUndefined();
  });
  it("uses adaptive for MiniMax M3 and preserves old clients' omitted fields", () => {
    const policy = getThinkingPolicy(route("MiniMax-M3", "minimax"));
    expect(getThinkingRequestParameters(policy, true)).toEqual({ thinking: { type: "adaptive" } });
    expect(getThinkingRequestParameters(policy, undefined)).toEqual({});
    expect(getThinkingRequestParameters(undefined, false)).toEqual({});
  });
  it("resolves defaults and explicit preferences without enabling unknown models", () => {
    expect(resolveThinkingEnabled({ defaultEnabled: false }, "auto")).toBe(false);
    expect(resolveThinkingEnabled({ defaultEnabled: false }, "enabled")).toBe(true);
    expect(resolveThinkingEnabled({ defaultEnabled: true }, "disabled")).toBe(false);
    expect(resolveThinkingEnabled(undefined, "enabled")).toBeUndefined();
  });
});
