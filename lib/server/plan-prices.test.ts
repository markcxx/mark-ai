import { describe, expect, it, vi } from "vitest";
import {
  creditsPerMessage,
  DEFAULT_PLANS,
  estimateMessages,
  parsePlans,
  type PlanModel,
} from "@/lib/plans";
import { getModelMetadata } from "@/lib/model-metadata";
import { defaultPlanPrice } from "./plan-prices";

vi.mock("server-only", () => ({}));

describe("site model prices", () => {
  it.each([
    "gpt-image-2.5-flare",
    "gpt-image-2.5-sunburst",
    "gpt-image-2.6-flare",
    "gpt-image-2.6-sunburst",
  ])("bills %s per image through the shared credit pool", (id) => {
    const model: PlanModel = {
      ...defaultPlanPrice(id),
      key: `markai:${id}`,
      name: id,
      featured: false,
      category: "flagship",
      freeAccess: false,
    };
    const config = {
      ...DEFAULT_PLANS,
      creditsPerYuan: 240.01,
      models: [model],
      tiers: DEFAULT_PLANS.tiers.map((tier) => ({ ...tier, price: tier.price + 0.9 })),
    };
    expect(parsePlans(config)?.models[0]).toMatchObject({
      basis: "site",
      currency: "CNY",
      output: 0.5,
      unit: "image",
    });
    expect(config.tiers.map((tier) => creditsPerMessage(config, model, tier))).toEqual([
      25, 30, 35,
    ]);
    expect(config.tiers.map((tier) => estimateMessages(config, model, tier))).toEqual([
      80, 200, 400,
    ]);
  });

  it.each([
    ["gpt-5.6-terra", 2, 12, 0.2],
    ["gpt-6.1-terra", 1, 5, 0.05],
  ])("uses the official %s rate for the plan and model card", (id, input, output, cachedInput) => {
    expect(defaultPlanPrice(id)).toMatchObject({ input, output, currency: "USD", unit: "mtok" });
    expect(getModelMetadata(id)?.pricing).toMatchObject({ input, output, cachedInput });
  });
});
