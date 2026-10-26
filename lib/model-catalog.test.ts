import { describe, expect, it } from "vitest";
import snapshot from "../data/model-catalog.json";
import {
  parseArtificialAnalysis,
  parseModelsDev,
  resolveCatalogMetadata,
  type ModelCatalog,
} from "./model-catalog";
import { getModelMetadata } from "./model-metadata";

const catalog = snapshot as ModelCatalog;
const aaRow = (slug: string, input: unknown, output: unknown, intelligence: unknown = 50) => ({
  id: slug,
  slug,
  name: slug,
  evaluations: { artificial_analysis_intelligence_index: intelligence },
  pricing: {
    price_1m_input_tokens: input,
    price_1m_output_tokens: output,
    price_1m_cache_hit_tokens: 0,
    price_1m_cache_write_tokens: null,
  },
  performance: { median_output_tokens_per_second: 100 },
});

describe("model catalog", () => {
  it("does not graft a provider's newer canonical alias onto an older proxy model", () => {
    const local = getModelMetadata("deepseek-v4-flash");
    const resolved = resolveCatalogMetadata(
      { id: "deepseek-v4-flash", provider: "proxy" },
      catalog,
    );
    expect(local?.supportsVision).not.toBe(true);
    expect(resolved?.supportsVision).not.toBe(true);
    expect(resolved?.benchmark?.modelName).toBe("DeepSeek V4 Flash 0731 (Max)");
    expect(
      resolveCatalogMetadata({ id: "deepseek-v4-flash", provider: "deepseek" }, catalog)
        ?.supportsVision,
    ).toBe(true);
  });
  it("retains zero cache prices and omits missing, negative and malformed measurements", () => {
    const rows = parseArtificialAnalysis([
      aaRow("known", 1, 2, 0),
      aaRow("unknown", null, "2", -1),
    ]);
    expect(rows[0].pricing).toMatchObject({ cachedInput: 0, input: 1, output: 2 });
    expect(rows[0].pricing?.cacheWrite).toBeUndefined();
    expect(rows[0].intelligence).toBe(0);
    expect(rows[0].ratings.coding).toBeUndefined();
    expect(rows[1].pricing).toBeUndefined();
    expect(rows[1].ratings.intelligence).toBeUndefined();
    expect(rows[1].ratings.price).toBeUndefined();
  });

  it("ranks ties consistently and makes cheaper prices score higher", () => {
    const rows = parseArtificialAnalysis([
      aaRow("cheap", 1, 1),
      aaRow("expensive", 10, 10),
      aaRow("tie", 1, 1),
    ]);
    expect(rows[0].ratings.intelligence).toBe(rows[1].ratings.intelligence);
    expect(rows[0].ratings.price).toBe(rows[2].ratings.price);
    expect(rows[0].ratings.price!).toBeGreaterThan(rows[1].ratings.price!);
  });

  it("keeps Haiku and Sonnet as distinct models", () => {
    expect(getModelMetadata("claude-haiku-4-5-20251001")?.id).toBe("claude-haiku-4-5");
    expect(getModelMetadata("claude-sonnet-4-5")?.id).toBe("claude-sonnet-4-5");
    expect(getModelMetadata("claude-opus-4-5")?.id).not.toBe("claude-sonnet-4-5");
    expect(
      resolveCatalogMetadata(
        { id: "claude-haiku-4-5-20251001-thinking", provider: "proxy" },
        catalog,
      )?.displayName,
    ).toBe("Claude Haiku 4.5");
  });

  it.each([
    "gpt-6.1-sol",
    "claude-sonnet-5.5",
    "claude-sonnet-5.5-thinking",
    "claude-sonnet-5",
    "deepseek-v4.1-flash-1017",
    "deepseek-v4-pro-0813",
    "deepseek-v4-flash-0731",
  ])("resolves configured model %s with sourced specifications and reference pricing", (id) => {
    const metadata = resolveCatalogMetadata({ id, provider: "proxy" }, catalog);
    expect(metadata?.contextWindowTokens).toBeGreaterThan(0);
    expect(metadata?.pricing?.sourceUrl).toMatch(/^https:/);
    expect(metadata?.benchmark?.modelName).toBeTruthy();
    expect(metadata?.benchmark?.updatedAt).toBe(catalog.evaluationsUpdatedAt);
    expect(metadata?.ratings?.intelligence).toBeGreaterThanOrEqual(0);
  });

  it("prefers the exact dated evaluation to a family alias and shows its reasoning setting", () => {
    const metadata = resolveCatalogMetadata(
      { id: "deepseek-v4.1-flash-1017", provider: "proxy" },
      catalog,
    );
    expect(metadata?.benchmark?.modelName).toBe("DeepSeek V4.1 Flash 1017 (Max)");
    expect(metadata?.displayName).toContain("261017");
    expect(
      resolveCatalogMetadata({ id: "gpt-6.1-sol", provider: "proxy" }, catalog)?.benchmark
        ?.modelName,
    ).toContain("Max");
  });

  it("does not fuzzy-match custom versions or merge reasoning levels", () => {
    expect(
      resolveCatalogMetadata({ id: "gpt-6.1-sol-private", provider: "proxy" }, catalog),
    ).toBeUndefined();
    const custom: ModelCatalog = {
      version: 1,
      updatedAt: "2026-10-26",
      indexVersion: "4.3",
      specifications: [],
      evaluations: parseArtificialAnalysis([aaRow("demo-high", 1, 1), aaRow("demo-low", 1, 1)]),
    };
    expect(resolveCatalogMetadata({ id: "demo", provider: "proxy" }, custom)).toBeUndefined();
    expect(
      resolveCatalogMetadata({ id: "demo-high", provider: "proxy" }, custom)?.benchmark?.modelName,
    ).toBe("demo-high");
  });

  it("resolves provider limits independently and applies only the matching provider override", () => {
    const custom: ModelCatalog = {
      version: 1,
      updatedAt: "2026-10-26",
      indexVersion: "4.3",
      evaluations: [],
      specifications: parseModelsDev({
        openai: {
          models: {
            demo: {
              id: "demo",
              name: "Demo",
              limit: { context: 1000 },
              cost: { input: 1, output: 2 },
            },
          },
        },
        anthropic: {
          models: {
            demo: {
              id: "demo",
              name: "Demo",
              limit: { context: 2000 },
              cost: { input: 3, output: 4 },
            },
          },
        },
      }),
    };
    const overrides = { "openai/demo": { contextWindowTokens: 3000 } };
    expect(
      resolveCatalogMetadata({ id: "demo", provider: "openai" }, custom, overrides)
        ?.contextWindowTokens,
    ).toBe(3000);
    expect(
      resolveCatalogMetadata({ id: "demo", provider: "anthropic" }, custom, overrides)
        ?.contextWindowTokens,
    ).toBe(2000);
    expect(
      resolveCatalogMetadata({ id: "demo", provider: "anthropic" }, custom)?.pricing?.input,
    ).toBe(3);
  });
});
