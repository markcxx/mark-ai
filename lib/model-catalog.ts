import {
  getModelMetadata,
  type ModelMetadata,
  type ModelPricing,
  type ModelRatings,
  type ModelCapabilityScores,
} from "./model-metadata";
import { CAPABILITY_AXES } from "./model-ratings";

export type CatalogSpecification = {
  provider: string;
  modelId: string;
  canonicalId?: string;
  metadata: ModelMetadata;
};

export type CatalogEvaluation = {
  id: string;
  slug: string;
  name: string;
  intelligence?: number;
  coding?: number;
  agentic?: number;
  capabilities?: ModelCapabilityScores;
  outputTokensPerSecond?: number;
  timeToFirstTokenSeconds?: number;
  pricing?: ModelPricing;
  ratings: ModelRatings;
};

export type ModelCatalog = {
  version: 1;
  updatedAt: string;
  specificationsUpdatedAt?: string;
  evaluationsUpdatedAt?: string;
  indexVersion: string;
  specifications: CatalogSpecification[];
  evaluations: CatalogEvaluation[];
};

// Punctuation changes are common between catalogs. Do not remove version numbers,
// dates, reasoning levels or model tiers: these can describe different models.
export const modelIdentity = (id: string) =>
  (id.trim().toLowerCase().split("/").filter(Boolean).at(-1) || "")
    .replace(/[._\s]+/g, "-")
    .replace(/-+/g, "-");

export const finiteNonnegative = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

export function parseArtificialAnalysis(rows: unknown[]): CatalogEvaluation[] {
  const entries = rows.flatMap((row): CatalogEvaluation[] => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, any>;
    if (
      typeof value.id !== "string" ||
      typeof value.slug !== "string" ||
      typeof value.name !== "string"
    )
      return [];
    const input = finiteNonnegative(value.pricing?.price_1m_input_tokens);
    const output = finiteNonnegative(value.pricing?.price_1m_output_tokens);
    return [
      {
        id: value.id,
        slug: value.slug,
        name: value.name,
        intelligence: finiteNonnegative(value.evaluations?.artificial_analysis_intelligence_index),
        coding: finiteNonnegative(value.evaluations?.artificial_analysis_coding_index),
        agentic: finiteNonnegative(value.evaluations?.artificial_analysis_agentic_index),
        capabilities: Object.fromEntries(
          CAPABILITY_AXES.flatMap((axis) => {
            const score = finiteNonnegative(value.evaluations?.[axis.field]);
            return score === undefined ? [] : [[axis.key, score]];
          }),
        ),
        outputTokensPerSecond: finiteNonnegative(
          value.performance?.median_output_tokens_per_second,
        ),
        timeToFirstTokenSeconds: finiteNonnegative(
          value.performance?.median_time_to_first_token_seconds,
        ),
        pricing:
          input !== undefined && output !== undefined
            ? {
                currency: "USD",
                input,
                output,
                cachedInput: finiteNonnegative(value.pricing?.price_1m_cache_hit_tokens),
                cacheWrite: finiteNonnegative(value.pricing?.price_1m_cache_write_tokens),
                sourceUrl: "https://artificialanalysis.ai/",
                sourceLabel: "Artificial Analysis 参考价格，非当前线路报价",
              }
            : undefined,
        ratings: {},
      },
    ];
  });
  // Percentile within this dated AA snapshot. Ties receive the same midpoint
  // rank, and missing measurements remain absent rather than becoming zero.
  const percentile = (value: number | undefined, all: number[], inverse = false) => {
    if (value === undefined || !all.length) return undefined;
    const lower = all.filter((item) => item < value).length;
    const equal = all.filter((item) => item === value).length;
    const rank = (100 * (lower + equal / 2)) / all.length;
    return Math.round(inverse ? 100 - rank : rank);
  };
  const values = (key: "intelligence" | "coding" | "agentic" | "outputTokensPerSecond") =>
    entries.flatMap((entry) => (entry[key] === undefined ? [] : [entry[key]!]));
  const prices = entries.flatMap((entry) =>
    entry.pricing ? [(3 * entry.pricing.input + entry.pricing.output) / 4] : [],
  );
  for (const entry of entries) {
    entry.ratings = {
      ...Object.fromEntries(
        CAPABILITY_AXES.map((axis) => [
          axis.key,
          percentile(
            entry.capabilities?.[axis.key],
            entries.flatMap((item) => {
              const value = item.capabilities?.[axis.key];
              return value === undefined ? [] : [value];
            }),
          ),
        ]),
      ),
      intelligence: percentile(entry.intelligence, values("intelligence")),
      coding: percentile(entry.coding, values("coding")),
      agentic: percentile(entry.agentic, values("agentic")),
      speed: percentile(entry.outputTokensPerSecond, values("outputTokensPerSecond")),
      price: percentile(
        entry.pricing ? (3 * entry.pricing.input + entry.pricing.output) / 4 : undefined,
        prices,
        true,
      ),
    };
  }
  return entries;
}

const SPEC_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "alibaba-cn",
  "alibaba",
  "zhipuai",
  "zai",
  "moonshotai-cn",
  "moonshotai",
  "minimax-cn",
  "minimax",
  "xiaomi",
  "xai",
  "volcengine",
];

export function parseModelsDev(payload: Record<string, any>): CatalogSpecification[] {
  return SPEC_PROVIDERS.flatMap((provider) =>
    Object.values(payload[provider]?.models || {}).flatMap((raw): CatalogSpecification[] => {
      if (!raw || typeof raw !== "object") return [];
      const model = raw as Record<string, any>;
      if (typeof model.id !== "string" || typeof model.name !== "string") return [];
      const sourceUrl = `https://models.dev/?search=${encodeURIComponent(model.id)}`;
      const input = finiteNonnegative(model.cost?.input);
      const output = finiteNonnegative(model.cost?.output);
      return [
        {
          provider,
          modelId: model.id,
          canonicalId:
            typeof model.canonical_model_id === "string" ? model.canonical_model_id : undefined,
          metadata: {
            id: model.id,
            displayName: model.name,
            family: typeof model.family === "string" ? model.family : provider,
            description: typeof model.description === "string" ? model.description : "",
            sourceUrl,
            contextWindowTokens: finiteNonnegative(model.limit?.context) || undefined,
            maxOutputTokens: finiteNonnegative(model.limit?.output) || undefined,
            knowledgeCutoff: typeof model.knowledge === "string" ? model.knowledge : undefined,
            supportsReasoning: typeof model.reasoning === "boolean" ? model.reasoning : undefined,
            supportsToolCalling: typeof model.tool_call === "boolean" ? model.tool_call : undefined,
            supportsVision: Array.isArray(model.modalities?.input)
              ? model.modalities.input.includes("image")
              : undefined,
            supportsVideo: Array.isArray(model.modalities?.input)
              ? model.modalities.input.includes("video")
              : undefined,
            pricing:
              input !== undefined && output !== undefined
                ? {
                    currency: "USD",
                    input,
                    output,
                    cachedInput: finiteNonnegative(model.cost?.cache_read),
                    cacheWrite: finiteNonnegative(model.cost?.cache_write),
                    sourceUrl,
                    sourceLabel: `models.dev · ${provider} 参考价格，非当前线路报价`,
                  }
                : undefined,
          },
        },
      ];
    }),
  );
}

const providerAliases: Record<string, string> = {
  gemini: "google",
  bailian: "alibaba-cn",
  zhipu: "zhipuai",
  moonshot: "moonshotai-cn",
  doubao: "volcengine",
};

// Explicit gateway aliases; never strip arbitrary suffixes from unknown IDs.
const catalogAliases: Record<string, string> = {
  "claude-sonnet-5-5-thinking": "claude-sonnet-5-5",
  "claude-haiku-4-5-20251001-thinking": "claude-haiku-4-5-20251001",
  "deepseek-v4-pro-0813": "deepseek-v4-pro",
  "deepseek-v4-flash-0731": "deepseek-v4-flash",
};

export function resolveCatalogMetadata(
  model: { id: string; provider: string },
  catalog: ModelCatalog,
  overrides: Record<string, Partial<ModelMetadata>> = {},
): ModelMetadata | undefined {
  const local = getModelMetadata(model.id);
  const requestedIdentity = modelIdentity(model.id);
  const identities = new Set(
    [model.id, catalogAliases[requestedIdentity], local?.id, ...(local?.aliases || [])]
      .filter((id): id is string => Boolean(id))
      .map(modelIdentity),
  );
  const provider = providerAliases[model.provider] || model.provider;
  let specification: CatalogSpecification | undefined;
  for (const identity of identities) {
    const exact = catalog.specifications.filter(
      (entry) => identity === modelIdentity(entry.modelId),
    );
    const canonical = catalog.specifications.filter(
      (entry) => entry.canonicalId && identity === modelIdentity(entry.canonicalId),
    );
    const matches = (exact.length ? exact : canonical).filter(
      (entry) =>
        !local ||
        !entry.canonicalId ||
        identities.has(modelIdentity(entry.canonicalId)) ||
        entry.provider === provider,
    );
    specification = matches.find((entry) => entry.provider === provider) || matches[0];
    if (specification) break;
  }
  // Keep local verified specs; external catalogs fill gaps. Provider-specific
  // limits may override canonical limits only when the provider is an exact match.
  let metadata: ModelMetadata | undefined = specification
    ? specification.provider === provider
      ? { ...local, ...specification.metadata }
      : { ...specification.metadata, ...local }
    : local
      ? { ...local }
      : undefined;
  if (metadata && specification?.provider === provider) {
    if (specification.metadata.contextWindowTokens)
      metadata.contextWindowTokens = specification.metadata.contextWindowTokens;
    if (specification.metadata.maxOutputTokens)
      metadata.maxOutputTokens = specification.metadata.maxOutputTokens;
  }
  if (specification?.canonicalId) identities.add(modelIdentity(specification.canonicalId));
  let evaluation: CatalogEvaluation | undefined;
  // Prefer the requested snapshot over broader aliases. AA's base slug can
  // represent a particular reasoning setting; always expose its full name.
  for (const identity of identities) {
    const bySlug = catalog.evaluations.filter((entry) => identity === modelIdentity(entry.slug));
    const byName = catalog.evaluations.filter((entry) => identity === modelIdentity(entry.name));
    const candidates = bySlug.length ? bySlug : byName;
    if (candidates.length === 1) {
      evaluation = candidates[0];
      break;
    }
  }
  if (evaluation) {
    metadata ||= {
      id: model.id,
      displayName: evaluation.name,
      family: model.id.split("-")[0],
      description: "",
      sourceUrl: "https://artificialanalysis.ai/",
    };
    metadata = {
      ...metadata,
      pricing:
        specification?.provider === provider
          ? specification.metadata.pricing || evaluation.pricing || metadata.pricing
          : evaluation.pricing || metadata.pricing,
      ratings: evaluation.ratings,
      benchmark: {
        sourceUrl: `https://artificialanalysis.ai/models/${encodeURIComponent(evaluation.slug)}`,
        updatedAt: catalog.evaluationsUpdatedAt || catalog.updatedAt,
        indexVersion: catalog.indexVersion,
        modelName: evaluation.name,
        intelligence: evaluation.intelligence,
        coding: evaluation.coding,
        agentic: evaluation.agentic,
        capabilities: evaluation.capabilities,
        outputTokensPerSecond: evaluation.outputTokensPerSecond,
        timeToFirstTokenSeconds: evaluation.timeToFirstTokenSeconds,
      },
    };
  }
  const override = overrides[`${model.provider}/${model.id}`];
  if (override)
    metadata = {
      id: model.id,
      displayName: model.id,
      family: "custom",
      description: "",
      sourceUrl: "",
      ...metadata,
      ...override,
    };
  return metadata;
}

export const getConfiguredModelMetadata = (model?: { id: string; metadata?: ModelMetadata }) =>
  model?.metadata || getModelMetadata(model?.id);
