import { expect, it } from "vitest";
import { getModelRatingAxes } from "./model-ratings";
import { parseArtificialAnalysis } from "./model-catalog";

it("keeps the original five dimensions when all are available", () => {
  expect(
    getModelRatingAxes({
      intelligence: 90,
      agentic: 80,
      coding: 70,
      speed: 60,
      price: 50,
      engineering: 100,
    }).map((axis) => axis.key),
  ).toEqual(["intelligence", "agentic", "coding", "speed", "price"]);
});

it("fills missing capability axes using stable priorities, not the highest scores", () => {
  expect(
    getModelRatingAxes({
      intelligence: 90,
      speed: 60,
      price: 50,
      engineering: 0,
      strategy: 40,
      finance: 100,
      legal: 100,
    }).map((axis) => axis.key),
  ).toEqual(["intelligence", "engineering", "strategy", "speed", "price"]);
});

it("uses the remaining available dimensions without inventing missing measurements", () => {
  expect(
    getModelRatingAxes({ intelligence: 90, engineering: 50, legal: 0, strategy: Number.NaN }).map(
      (axis) => axis.key,
    ),
  ).toEqual(["intelligence", "engineering", "legal"]);
});

it("preserves all six domain indices, including zero scores, and ranks each independently", () => {
  const rows = parseArtificialAnalysis([
    {
      id: "one",
      slug: "one",
      name: "One",
      evaluations: {
        artificial_analysis_engineering_index: 0,
        artificial_analysis_strategy_and_ops_index: 40,
        artificial_analysis_finance_and_accounting_index: 50,
        artificial_analysis_economics_index: 60,
        artificial_analysis_legal_index: 70,
        artificial_analysis_healthcare_and_medical_index: 80,
      },
    },
    {
      id: "two",
      slug: "two",
      name: "Two",
      evaluations: { artificial_analysis_engineering_index: 100 },
    },
  ]);
  expect(rows[0].capabilities).toEqual({
    engineering: 0,
    strategy: 40,
    finance: 50,
    economics: 60,
    legal: 70,
    healthcare: 80,
  });
  expect(rows[0].ratings.engineering).toBeLessThan(rows[1].ratings.engineering!);
  expect(rows[0].ratings.finance).toBe(50);
  expect(rows[1].ratings.finance).toBeUndefined();
});
