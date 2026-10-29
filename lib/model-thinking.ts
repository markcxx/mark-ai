/** Verified Chat Completions dialects; see docs/thinking-mode.md. Unknown routes stay unchanged. */
export type ThinkingCapability = { defaultEnabled: boolean };
export type ThinkingPolicy = ThinkingCapability & {
  parameter: "enable_thinking" | "thinking";
  enabledType?: "enabled" | "adaptive";
  autoToolChoice?: boolean;
};
type ModelRoute = { id: string; provider: string; baseUrl?: string; runtime: string };

// Configuration labels are arbitrary. A known endpoint takes precedence over
// the provider preset; names are only a fallback when no endpoint was supplied.
const THINKING_PROVIDERS = [
  {
    id: "bailian",
    names: ["bailian", "dashscope", "aliyun", "qwen"],
    domains: [
      "dashscope.aliyuncs.com",
      "dashscope-intl.aliyuncs.com",
      "dashscope-us.aliyuncs.com",
      "maas.aliyuncs.com",
    ],
  },
  {
    id: "siliconflow",
    names: ["siliconflow", "siliconcloud"],
    domains: ["siliconflow.cn", "siliconflow.com"],
  },
  { id: "volcengine", names: ["volcengine", "doubao", "ark"], domains: ["volces.com"] },
  { id: "deepseek", names: ["deepseek"], domains: ["deepseek.com"] },
  { id: "zhipu", names: ["zhipu", "zai", "glm"], domains: ["bigmodel.cn", "z.ai"] },
  {
    id: "moonshot",
    names: ["moonshot", "kimi"],
    domains: ["moonshot.cn", "moonshot.ai", "kimi.com"],
  },
  { id: "minimax", names: ["minimax"], domains: ["minimaxi.com", "minimax.io", "minimax.cn"] },
  { id: "mimo", names: ["mimo", "xiaomi"], domains: ["xiaomimimo.com"] },
  { id: "infiniai", names: ["infiniai", "infini"], domains: ["cloud.infini-ai.com"] },
] as const;

function getThinkingProvider(model: ModelRoute) {
  if (model.baseUrl?.trim()) {
    try {
      const url = new URL(model.baseUrl);
      if (!["https:", "http:"].includes(url.protocol)) return;
      const host = url.hostname.toLowerCase();
      return THINKING_PROVIDERS.find(({ domains }) =>
        domains.some((domain) => host === domain || host.endsWith(`.${domain}`)),
      )?.id;
    } catch {
      return;
    }
  }
  return THINKING_PROVIDERS.find(({ names }) =>
    (names as readonly string[]).includes(model.provider.trim().toLowerCase()),
  )?.id;
}

const qwenDefault = (id: string): boolean | undefined => {
  if (/thinking|instruct|coder|qwen3\.7-max-(preview|2026-05-17)|qwen3\.8-2\.4t/.test(id)) return;
  if (/^qwen3\.[5678]-(max|plus|flash)(-\d{4}(-\d{2}-\d{2})?)?$/.test(id)) return true;
  if (
    id === "qwen3.6-max-preview" ||
    /^qwen3\.[56]-(397b-a17b|122b-a10b|27b|35b-a3b)$/.test(id) ||
    id === "qwen3.8-27b"
  )
    return true;
  if (/^qwen3-(235b-a22b|32b|30b-a3b|14b|8b|4b|1\.7b|0\.6b)$/.test(id)) return true;
  if (/^qwen3-max($|-preview$|-2026-01-23$)/.test(id)) return false;
  if (/^qwen-(plus|flash|turbo)($|-latest$)/.test(id)) return false;
  const snapshot = id.match(/^qwen-(plus|flash|turbo)-(\d{4}-\d{2}-\d{2})$/);
  if (snapshot && snapshot[2] >= (snapshot[1] === "flash" ? "2025-07-28" : "2025-04-28"))
    return false;
};
const switchableGlm = (id: string) => /^glm-(4\.[567](v)?|5([v]|\.[12])?)($|-)/.test(id);
const switchableDeepSeek = (id: string) => /^deepseek-v(3\.[12]|4(\.1)?)($|-)/.test(id);
const switchableKimi = (id: string) => /^kimi-k2\.[56]$/.test(id);
const switchableMimo = (id: string) => /^mimo-v2\.(5(-pro)?|6-(flash|pro(-ultraspeed)?))$/.test(id);
const qwenVision = (id: string) => /^qwen3-vl-(plus|flash)(-latest|-\d{4}-\d{2}-\d{2})?$/.test(id);

export function getThinkingPolicy(model: ModelRoute): ThinkingPolicy | undefined {
  if (model.runtime !== "openai-compatible") return;
  const id = model.id.trim().toLowerCase().split("/").at(-1)!;
  const provider = getThinkingProvider(model);
  const policy = (
    defaultEnabled = true,
    parameter: ThinkingPolicy["parameter"] = "thinking",
  ): ThinkingPolicy => ({ defaultEnabled, parameter });

  // Aggregators use their own dialect, even when hosting another provider's model.
  if (provider === "bailian") {
    const qwen = qwenVision(id) ? false : qwenDefault(id);
    if (qwen !== undefined) return { ...policy(qwen, "enable_thinking"), autoToolChoice: true };
    if (switchableDeepSeek(id)) return policy(id.startsWith("deepseek-v4"), "enable_thinking");
    if (switchableGlm(id)) return policy(true, "enable_thinking");
    if (switchableKimi(id))
      return policy(model.id.toLowerCase().startsWith("kimi/"), "enable_thinking");
    return;
  }
  if (provider === "siliconflow") {
    const qwen = qwenDefault(id);
    if (qwen !== undefined) return policy(qwen, "enable_thinking");
    if (switchableDeepSeek(id) || switchableGlm(id) || switchableKimi(id))
      return policy(true, "enable_thinking");
    return;
  }
  if (provider === "volcengine") {
    if (
      (/^doubao-seed-(1-6|2-[01])($|-)/.test(id) && !/thinking|code/.test(id)) ||
      id === "doubao-seed-evolving" ||
      id === "doubao-seed-2-0-code-preview-260215"
    )
      return policy();
    if (
      /^deepseek-v4-(flash|pro)(-ga)?(-\d{6})?$/.test(id) ||
      /^deepseek-v4-1-flash-(260910|261017)$/.test(id) ||
      /^glm-5-2-\d{6}$/.test(id)
    )
      return policy();
    return;
  }
  if (provider === "deepseek" && (switchableDeepSeek(id) || /^deepseek-(flash|pro)$/.test(id)))
    return policy();
  if (provider === "zhipu" && switchableGlm(id)) return policy();
  if (provider === "moonshot" && switchableKimi(id)) return { ...policy(), autoToolChoice: true };
  if (provider === "minimax" && id === "minimax-m3")
    return { ...policy(), enabledType: "adaptive" };
  if (provider === "mimo" && switchableMimo(id)) return policy();
  if (provider === "infiniai") {
    const qwen = qwenDefault(id);
    if (qwen !== undefined) return { ...policy(qwen, "enable_thinking"), autoToolChoice: true };
    if (switchableDeepSeek(id) || switchableGlm(id) || switchableMimo(id)) return policy();
    if (switchableKimi(id)) return { ...policy(), autoToolChoice: true };
    if (id === "minimax-m3") return { ...policy(), enabledType: "adaptive" };
  }
  return;
}

export function getPublicThinkingCapability(model: ModelRoute): ThinkingCapability | undefined {
  const policy = getThinkingPolicy(model);
  return policy ? { defaultEnabled: policy.defaultEnabled } : undefined;
}

export function getThinkingRequestParameters(
  policy: ThinkingPolicy | undefined,
  enabled: boolean | undefined,
) {
  if (!policy || enabled === undefined) return {};
  return policy.parameter === "enable_thinking"
    ? { enable_thinking: enabled }
    : { thinking: { type: enabled ? policy.enabledType || "enabled" : "disabled" } };
}

export function resolveThinkingEnabled(
  capability: ThinkingCapability | undefined,
  mode: string,
): boolean | undefined {
  if (!capability) return;
  return mode === "auto" ? capability.defaultEnabled : mode === "enabled";
}
