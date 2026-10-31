import { describe, expect, it } from "vitest";
import {
  baseModelName,
  getRankingVendor,
  isReasoningModel,
  niceScale,
  paretoFrontier,
  rankModels,
  RANKING_METRICS,
  shortModelName,
  type RankingModel,
} from "./model-rankings";

const model = (id: string, intelligence?: number, name = id): RankingModel => ({
  id,
  name,
  slug: id,
  intelligence,
});
const intelligence = RANKING_METRICS[0];

it("keeps zero, excludes missing/nonfinite measurements and retains distinct effort variants", () => {
  const rows = [
    model("a-high", 50),
    model("a-low", 20),
    model("zero", 0),
    model("missing"),
    model("nan", NaN),
    model("infinity", Infinity),
  ];
  expect(rankModels(rows, intelligence).map((row) => row.model.id)).toEqual([
    "a-high",
    "a-low",
    "zero",
  ]);
});

it("preserves competition ranks after searching and vendor filtering", () => {
  const rows = [model("third", 20), model("first-b", 50), model("first-a", 50)];
  expect(rankModels(rows, intelligence).map((row) => row.rank)).toEqual([1, 1, 3]);
  expect(rankModels(rows, intelligence, { query: "THIRD" })[0].rank).toBe(3);
  expect(rows[0].id).toBe("third");
  const vendors = [model("gpt-5", 60), model("claude-opus-5", 55), model("gpt-4o", 40)];
  expect(
    rankModels(vendors, intelligence, { vendor: "openai" }).map((row) => [row.model.id, row.rank]),
  ).toEqual([
    ["gpt-5", 1],
    ["gpt-4o", 3],
  ]);
});

it("ranks latency in ascending order, including measured zero", () => {
  const metric = RANKING_METRICS.find((metric) => metric.key === "latency")!;
  const rows = [
    { ...model("slow"), timeToFirstTokenSeconds: 2 },
    { ...model("fast"), timeToFirstTokenSeconds: 0 },
    model("missing"),
  ];
  expect(rankModels(rows, metric).map((row) => row.model.id)).toEqual(["fast", "slow"]);
});

it("merges reasoning-effort variants into their best result", () => {
  const rows = [
    model("claude-max", 57, "Claude Opus 5.5 (Max, Default Fallback)"),
    model("claude-high", 53, "Claude Opus 5.5 (High, Default Fallback)"),
    model("gpt", 55, "GPT-6 (Xhigh)"),
    model("dated", 40, "GPT-4o (May '24)"),
  ];
  expect(
    rankModels(rows, intelligence, { mergeVariants: true }).map((row) => row.model.id),
  ).toEqual(["claude-max", "gpt", "dated"]);
});

describe("model labels", () => {
  it("detects reasoning variants", () => {
    expect(isReasoningModel("GPT-6 (Xhigh)")).toBe(true);
    expect(isReasoningModel("Hy3-preview (Non-reasoning)")).toBe(false);
    expect(isReasoningModel("Kimi K3.1 Pro")).toBeUndefined();
  });
  it("strips effort qualifiers but keeps dates and versions", () => {
    expect(baseModelName("Claude Opus 5.5 (Max, Default Fallback)")).toBe("Claude Opus 5.5");
    expect(baseModelName("GPT-4o (May '24)")).toBe("GPT-4o (May '24)");
    expect(shortModelName("Claude Opus 5.5 (Max, Default Fallback)")).toBe("Claude Opus 5.5 (Max)");
  });
  it("attributes fine-tunes by slug, not by base-model mentions in the name", () => {
    expect(getRankingVendor({ slug: "claude-opus-5" }).key).toBe("anthropic");
    expect(getRankingVendor({ slug: "o3-mini" }).key).toBe("openai");
    expect(getRankingVendor({ slug: "ring-flash" }).key).toBe("ant");
    expect(getRankingVendor({ slug: "unknown-lab-7b" }).key).toBe("other");
  });
});

it("rounds axis maxima to readable steps", () => {
  expect(niceScale(57.6)).toEqual({ max: 60, step: 20 });
  expect(niceScale(1661)).toEqual({ max: 2000, step: 500 });
  expect(niceScale(0)).toEqual({ max: 1, step: 0.25 });
});

it("finds the efficiency frontier for lower-is-better and higher-is-better axes", () => {
  const points = [
    { id: "cheap-weak", x: 1, y: 30 },
    { id: "mid", x: 5, y: 50 },
    { id: "dominated", x: 6, y: 45 },
    { id: "pricey-best", x: 20, y: 60 },
  ];
  expect(paretoFrontier(points, true).map((point) => point.id)).toEqual([
    "cheap-weak",
    "mid",
    "pricey-best",
  ]);
  expect(paretoFrontier(points, false).map((point) => point.id)).toEqual(["pricey-best"]);
});
