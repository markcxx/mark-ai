import { describe, expect, it } from "vitest";
import {
  creditsPerMessage,
  DEFAULT_PLANS,
  estimateMessages,
  isFreeModel,
  parsePlans,
  type PlanConfig,
} from "./plans";

const model = {
  key: "openai:gpt-mini",
  name: "GPT mini",
  input: 0.15,
  output: 0.6,
  currency: "USD" as const,
  unit: "mtok" as const,
  source: "",
  basis: "manufacturer" as const,
  note: "",
  checkedAt: "2026-11-01",
  status: "verified" as const,
  featured: true,
  category: "everyday" as const,
  priceOverride: null,
  freeAccess: true,
};
const config = (patch: Partial<typeof model>): PlanConfig => ({
  ...DEFAULT_PLANS,
  models: [{ ...model, ...patch }],
});

describe("free access and shared allowance", () => {
  it("keeps per-model free access and the shared monthly count", () => {
    const parsed = parsePlans({ ...config({ freeAccess: true }), freeMessages: 50 });
    expect(parsed?.models[0].freeAccess).toBe(true);
    expect(parsed?.freeMessages).toBe(50);
  });
  it("defaults missing access to paid only", () => {
    const { freeAccess: _omit, ...legacy } = model;
    const parsed = parsePlans({ ...DEFAULT_PLANS, models: [legacy] });
    expect(isFreeModel(parsed!.models[0])).toBe(false);
  });
  it("rejects invalid shared counts", () => {
    expect(parsePlans({ ...config({}), freeMessages: -1 })).toBeNull();
    expect(parsePlans({ ...config({}), freeMessages: 1.5 })).toBeNull();
  });
});

describe("creditsPerMessage", () => {
  it("derives a whole number of credits from price and the reference conversation", () => {
    // 8000 × $0.15 + 1500 × $0.6 per million = $0.0021 → ¥0.01512 × 100 → 2 credits
    expect(creditsPerMessage(DEFAULT_PLANS, model)).toBe(2);
  });
  it("charges at least one credit for any paid model and nothing for free ones", () => {
    expect(creditsPerMessage(DEFAULT_PLANS, { ...model, input: 0.0001, output: 0.0001 })).toBe(1);
    expect(creditsPerMessage(DEFAULT_PLANS, { ...model, input: 0, output: 0 })).toBe(0);
  });
  it("lets an admin override win over price", () => {
    expect(creditsPerMessage(DEFAULT_PLANS, { ...model, creditsOverride: 25 })).toBe(25);
  });
  it("maps base credits to monthly conversations", () => {
    expect(estimateMessages(DEFAULT_PLANS, { ...model, creditsOverride: 25 }, 1)).toBe(80);
  });
  it("accepts custom credit settings and rejects invalid ones", () => {
    expect(parsePlans({ ...config({}), baseCredits: 5000 })?.baseCredits).toBe(5000);
    expect(parsePlans({ ...config({}), baseCredits: 0 })).toBeNull();
    expect(parsePlans({ ...config({}), creditsPerYuan: 0 })).toBeNull();
  });
});
