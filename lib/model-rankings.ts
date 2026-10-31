import type { CatalogEvaluation } from "./model-catalog";
import { CAPABILITY_AXES } from "./model-ratings";

export type RankingModel = Pick<
  CatalogEvaluation,
  | "id"
  | "slug"
  | "name"
  | "intelligence"
  | "coding"
  | "agentic"
  | "capabilities"
  | "outputTokensPerSecond"
  | "timeToFirstTokenSeconds"
  | "pricing"
>;

export type RankingMetricGroup = "intelligence" | "capabilities" | "efficiency";

export type RankingMetric = {
  key: string;
  label: string;
  shortLabel: string;
  group: RankingMetricGroup;
  unit: string;
  digits: number;
  lowerIsBetter?: boolean;
  description: string;
  value: (model: RankingModel) => number | undefined;
};

// AA's blended price weights input:output at 3:1, matching its leaderboard.
export const blendedPrice = (model: RankingModel) =>
  model.pricing ? (3 * model.pricing.input + model.pricing.output) / 4 : undefined;

export const RANKING_METRICS: RankingMetric[] = [
  {
    key: "intelligence",
    label: "综合智能指数",
    shortLabel: "综合智能",
    group: "intelligence",
    unit: "分",
    digits: 1,
    description: "Artificial Analysis Intelligence Index，汇总推理、知识、数学、编码等多项评测。",
    value: (model) => model.intelligence,
  },
  {
    key: "coding",
    label: "编码指数",
    shortLabel: "编码",
    group: "intelligence",
    unit: "分",
    digits: 1,
    description: "Artificial Analysis Coding Index，衡量代码生成与软件工程任务表现。",
    value: (model) => model.coding,
  },
  {
    key: "agentic",
    label: "Agentic 指数",
    shortLabel: "Agentic",
    group: "intelligence",
    unit: "分",
    digits: 1,
    description: "Artificial Analysis Agentic Index，衡量工具调用与多步任务执行能力。",
    value: (model) => model.agentic,
  },
  ...CAPABILITY_AXES.map((axis): RankingMetric => ({
    key: axis.key,
    label: `${axis.label}能力指数`,
    shortLabel: axis.label,
    group: "capabilities",
    unit: "分",
    digits: 1,
    description: `Artificial Analysis ${axis.label}领域能力指数，仅包含具有完整评测数据的模型。`,
    value: (model) => model.capabilities?.[axis.key],
  })),
  {
    key: "speed",
    label: "输出速度",
    shortLabel: "输出速度",
    group: "efficiency",
    unit: "tokens/s",
    digits: 0,
    description: "跨提供商的输出速度中位数，不代表 MarkAI 当前线路实测。",
    value: (model) => model.outputTokensPerSecond,
  },
  {
    key: "latency",
    label: "首字延迟",
    shortLabel: "首字延迟",
    group: "efficiency",
    unit: "秒",
    digits: 2,
    lowerIsBetter: true,
    description: "首个 token 的等待时间中位数，不等于完整答案的等待时间。",
    value: (model) => model.timeToFirstTokenSeconds,
  },
  {
    key: "blendedPrice",
    label: "综合价格",
    shortLabel: "综合价格",
    group: "efficiency",
    unit: "美元 / 百万 tokens",
    digits: 2,
    lowerIsBetter: true,
    description: "按输入 3 : 输出 1 加权的参考价格，不代表当前线路报价或每任务成本。",
    value: blendedPrice,
  },
  {
    key: "inputPrice",
    label: "输入价格",
    shortLabel: "输入价格",
    group: "efficiency",
    unit: "美元 / 百万 tokens",
    digits: 2,
    lowerIsBetter: true,
    description: "AA 参考输入价格，不代表当前线路报价。",
    value: (model) => model.pricing?.input,
  },
  {
    key: "outputPrice",
    label: "输出价格",
    shortLabel: "输出价格",
    group: "efficiency",
    unit: "美元 / 百万 tokens",
    digits: 2,
    lowerIsBetter: true,
    description: "AA 参考输出价格，不包含推理 token 用量差异，不代表当前线路报价。",
    value: (model) => model.pricing?.output,
  },
];

export type RankingVendor = {
  key: string;
  label: string;
  /** Bar color in light mode, and its dark-mode counterpart. */
  color: string;
  darkColor?: string;
  /** Text color on top of the bar in dark mode when the dark bar is light. */
  darkText?: string;
  icon?: string;
};

const VENDOR_RULES: Array<RankingVendor & { pattern: RegExp }> = [
  {
    key: "openai",
    label: "OpenAI",
    color: "#202123",
    darkColor: "#e8e8e8",
    darkText: "#111",
    icon: "openai",
    pattern: /^(?:gpt|chatgpt|o[1345](?:$|-))/,
  },
  { key: "anthropic", label: "Anthropic", color: "#cc785c", icon: "anthropic", pattern: /claude/ },
  {
    key: "google",
    label: "Google",
    color: "#34a853",
    icon: "gemini-color",
    pattern: /gemini|gemma|^palm/,
  },
  { key: "meta", label: "Meta", color: "#0866ff", icon: "meta", pattern: /llama|^muse/ },
  { key: "xai", label: "xAI", color: "#7671d0", icon: "xai", pattern: /grok/ },
  { key: "deepseek", label: "DeepSeek", color: "#4d6bfe", icon: "deepseek", pattern: /deepseek/ },
  { key: "qwen", label: "通义千问", color: "#ff6a00", icon: "qwen", pattern: /qwen|qwq/ },
  { key: "moonshot", label: "月之暗面", color: "#1783ff", icon: "moonshot", pattern: /kimi/ },
  { key: "xiaomi", label: "小米", color: "#ff6900", icon: "xiaomimimo", pattern: /mimo/ },
  { key: "zhipu", label: "智谱", color: "#3859ff", icon: "zai", pattern: /glm/ },
  { key: "minimax", label: "MiniMax", color: "#e73562", icon: "minimax", pattern: /minimax/ },
  {
    key: "mistral",
    label: "Mistral",
    color: "#fa520f",
    icon: "mistral",
    pattern: /mistral|mixtral|magistral|devstral|ministral|pixtral|codestral/,
  },
  {
    key: "bytedance",
    label: "字节跳动",
    color: "#3c8cff",
    icon: "doubao-color",
    pattern: /doubao|^seed/,
  },
  { key: "ant", label: "蚂蚁百灵", color: "#5b6cf9", pattern: /^(?:ling|ring)-/ },
  { key: "stepfun", label: "阶跃星辰", color: "#14a39a", pattern: /^step/ },
  { key: "tencent", label: "腾讯混元", color: "#0a65e8", pattern: /^hy\d|hunyuan/ },
  { key: "nvidia", label: "NVIDIA", color: "#76b900", pattern: /nemotron|^nvidia/ },
  { key: "amazon", label: "Amazon", color: "#ff9900", pattern: /^nova-/ },
];

export const OTHER_VENDOR: RankingVendor = {
  key: "other",
  label: "其他",
  color: "#9ca3af",
  darkColor: "#4b5563",
};

export const RANKING_VENDORS: RankingVendor[] = [
  ...VENDOR_RULES.map(({ pattern: _pattern, ...vendor }) => vendor),
  OTHER_VENDOR,
];

// Match the AA slug only: display names of fine-tunes mention their base model
// ("Based on Qwen3.5"), which would attribute them to the wrong vendor.
export function getRankingVendor(model: Pick<RankingModel, "slug">): RankingVendor {
  const slug = model.slug.toLowerCase();
  const rule = VENDOR_RULES.find(({ pattern }) => pattern.test(slug));
  if (!rule) return OTHER_VENDOR;
  const { pattern: _pattern, ...vendor } = rule;
  return vendor;
}

const EFFORT_WORDS = /^(?:reasoning|thinking|adaptive|minimal|low|medium|high|xhigh|max)$/i;

/** True for reasoning variants, false for explicit non-reasoning variants, undefined otherwise. */
export function isReasoningModel(name: string): boolean | undefined {
  const qualifiers = [...name.matchAll(/\(([^)]*)\)/g)].flatMap((match) =>
    match[1].split(",").map((part) => part.trim()),
  );
  if (qualifiers.some((part) => /^non-reasoning$/i.test(part))) return false;
  if (qualifiers.some((part) => EFFORT_WORDS.test(part)) || /\bthinking\b/i.test(name)) return true;
  return undefined;
}

/** Model family name without the effort qualifier, used to merge variants. */
export const baseModelName = (name: string) =>
  name
    .replace(/\s*\(([^)]*)\)/g, (whole, inner: string) => {
      const parts = inner.split(",").map((part) => part.trim());
      return parts.some((part) => EFFORT_WORDS.test(part) || /^non-reasoning$/i.test(part))
        ? ""
        : whole;
    })
    .trim();

/** Compact chart label: keep only the first qualifier, e.g. "Claude Opus 5.5 (Max)". */
export const shortModelName = (name: string) => name.replace(/\(([^,)]*),[^)]*\)/, "($1)").trim();

export type RankedRow = {
  model: RankingModel;
  vendor: RankingVendor;
  reasoning?: boolean;
  value: number;
  rank: number;
};

export type RankOptions = {
  query?: string;
  vendor?: string;
  /** Keep only the best variant of each model family for this metric. */
  mergeVariants?: boolean;
};

const measured = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// Rank the entire dated snapshot before filtering. Missing values are never zero;
// ties share competition rank. Vendor and search filters never change ranks.
export function rankModels(
  models: RankingModel[],
  metric: RankingMetric,
  options: RankOptions = {},
): RankedRow[] {
  const better = (a: number, b: number) => (metric.lowerIsBetter ? a - b : b - a);
  let rows = models.flatMap((model) => {
    const value = metric.value(model);
    return measured(value) ? [{ model, value }] : [];
  });
  if (options.mergeVariants) {
    const best = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = baseModelName(row.model.name).toLowerCase();
      const current = best.get(key);
      if (!current || better(row.value, current.value) < 0) best.set(key, row);
    }
    rows = [...best.values()];
  }
  const sorted = rows.sort(
    (a, b) =>
      better(a.value, b.value) ||
      a.model.name.localeCompare(b.model.name, "en") ||
      a.model.id.localeCompare(b.model.id),
  );
  let rank = 0;
  const search = options.query?.trim().toLowerCase() || "";
  return sorted
    .map((row, index): RankedRow => {
      if (index === 0 || row.value !== sorted[index - 1].value) rank = index + 1;
      return {
        ...row,
        rank,
        vendor: getRankingVendor(row.model),
        reasoning: isReasoningModel(row.model.name),
      };
    })
    .filter(
      (row) =>
        (!options.vendor || row.vendor.key === options.vendor) &&
        `${row.model.name} ${row.model.slug}`.toLowerCase().includes(search),
    );
}

export const formatRankingValue = (value: number, digits = 2) =>
  value.toLocaleString("en-US", {
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : digits,
    minimumFractionDigits: 0,
  });

/**
 * Points not dominated on (higher y, better x). With lowerIsBetter, smaller x
 * is better (price, latency); otherwise larger x is better (speed).
 */
export function paretoFrontier<T extends { x: number; y: number }>(
  points: T[],
  lowerIsBetter: boolean,
): T[] {
  const ordered = [...points].sort((a, b) =>
    lowerIsBetter ? a.x - b.x || b.y - a.y : b.x - a.x || b.y - a.y,
  );
  const frontier: T[] = [];
  let bestY = -Infinity;
  for (const point of ordered) {
    if (point.y > bestY) {
      frontier.push(point);
      bestY = point.y;
    }
  }
  return frontier;
}

/** Round an axis maximum up to a readable 1/2/2.5/5 step. */
export function niceScale(maximum: number, ticks = 4) {
  if (!(maximum > 0)) return { max: 1, step: 0.25 };
  const raw = maximum / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= raw) || 10) * magnitude;
  return { max: step * Math.ceil(maximum / step), step };
}

export const median = (values: number[]) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
