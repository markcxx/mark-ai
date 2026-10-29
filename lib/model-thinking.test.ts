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
    ["MiniMax-M2.7", "minimax"],
    ["MiniMax-M3.1-Flash", "minimax"],
    ["glm-5.3", "zhipu"],
    ["glm-5.3-flash", "zhipu"],
    ["glm-4-flash", "zhipu"],
    ["qwen3-235b-a22b-thinking-2507", "bailian"],
    ["qwen3-coder-plus", "bailian"],
    ["qwen3.7-max-preview", "bailian"],
    ["qwen-plus-2025-01-25", "bailian"],
    ["deepseek-r1", "siliconflow"],
    ["kimi-k2-thinking", "moonshot"],
    ["kimi-k2.7-code", "moonshot"],
    ["kimi-k3", "moonshot"],
    ["kimi-k3.1-pro", "moonshot"],
    ["qwen3.8-2.4t-a95b", "bailian"],
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
  it.each([
    [
      "bailian",
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "deepseek-v4.1-flash-1017",
      "enable_thinking",
    ],
    [
      "bailian",
      "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      "qwen3-vl-flash",
      "enable_thinking",
    ],
    [
      "siliconflow",
      "https://api.siliconflow.cn/v1",
      "Pro/deepseek-ai/DeepSeek-V4.1-Flash",
      "enable_thinking",
    ],
    ["deepseek", "https://api.deepseek.com/v1", "deepseek-v4.1-flash", "thinking"],
    ["mimo", "https://api.xiaomimimo.com/v1", "mimo-v2.6-pro", "thinking"],
    ["mimo", "https://api.xiaomimimo.com/v1", "mimo-v2.6-pro-ultraspeed", "thinking"],
    ["mimo", "https://api.xiaomimimo.com/v1", "mimo-v2.6-flash", "thinking"],
    ["infiniai", "https://cloud.infini-ai.com/maas/v1", "deepseek-v4.1-flash-1017", "thinking"],
    ["infiniai", "https://cloud.infini-ai.com/maas/v1", "qwen3.6-27b", "enable_thinking"],
    [
      "volcengine",
      "https://ark.cn-beijing.volces.com/api/v3",
      "doubao-seed-2-0-code-preview-260215",
      "thinking",
    ],
    ["volcengine", "https://ark.cn-beijing.volces.com/api/v3", "doubao-seed-evolving", "thinking"],
  ])(
    "uses the same %s policy for presets and arbitrary configuration labels (%s, %s)",
    (preset, url, id, parameter) => {
      const expected = getThinkingPolicy(route(id, preset));
      expect(expected?.parameter).toBe(parameter);
      for (const label of [
        preset,
        "custom-channel-123",
        "mark-example",
        "team-account",
        "bailian",
      ]) {
        const policy = getThinkingPolicy(route(id, label, url));
        expect(policy).toEqual(expected);
        expect(getThinkingRequestParameters(policy, false)).toEqual(
          parameter === "enable_thinking"
            ? { enable_thinking: false }
            : { thinking: { type: "disabled" } },
        );
      }
    },
  );
  it("does not infer a dialect from a misleading label or lookalike hostname", () => {
    for (const url of [
      "https://api.deepseek.com.evil.example/v1",
      "https://unverified.example/v1",
      "not a URL",
      "file:///api.deepseek.com",
    ]) {
      expect(getThinkingPolicy(route("deepseek-v4.1-flash", "deepseek", url))).toBeUndefined();
    }
    expect(getThinkingPolicy(route("deepseek-v4.1-flash", "markdeepseek"))).toBeUndefined();
    expect(
      getThinkingPolicy(
        route("qwen3.8-flash", "custom", "https://bucket.oss-cn-beijing.aliyuncs.com"),
      ),
    ).toBeUndefined();
  });
  it("keeps Qwen VL default off and avoids forced tools while Bailian is thinking", () => {
    const policy = getThinkingPolicy(route("qwen3-vl-flash-2025-10-15", "bailian"));
    expect(policy).toMatchObject({ defaultEnabled: false, autoToolChoice: true });
    expect(getThinkingRequestParameters(policy, true)).toEqual({ enable_thinking: true });
    expect(getThinkingPolicy(route("qwen3-vl-235b-a22b-thinking", "bailian"))).toBeUndefined();
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
  it.each([
    "deepseek-v4-flash-ga-260731",
    "deepseek-v4-1-flash-260910",
    "deepseek-v4-1-flash-261017",
    "doubao-seed-2-1-lite-260915",
  ])("supports the verified Ark thinking switch for %s", (id) => {
    const policy = getThinkingPolicy(
      route(id, "markdoubao_key2", "https://ark.cn-beijing.volces.com/api/v3"),
    );
    expect(policy).toBeDefined();
    expect(getThinkingRequestParameters(policy, false)).toEqual({ thinking: { type: "disabled" } });
    expect(getThinkingRequestParameters(policy, true)).toEqual({ thinking: { type: "enabled" } });
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
