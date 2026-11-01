import "server-only";
import type { ModelPrice } from "@/lib/plans";
import prices from "./plan-prices-data.json";

// Explicit IDs only: a new release or a priority variant must never inherit an
// unrelated model's price. Facts are a reviewed snapshot, not a live price API.
const catalog = new Map<string, ModelPrice>(
  prices.map(({ id, ...price }) => [id.toLowerCase(), price as ModelPrice]),
);
export function officialPlanPrice(id: string): ModelPrice {
  return (
    catalog.get(id.toLowerCase()) ?? {
      input: null,
      output: null,
      currency: "CNY",
      unit: "mtok",
      source: "",
      basis: "manufacturer",
      note: "尚未核实该完整型号的官方报价，可填写渠道实际输入、输出价格。",
      checkedAt: "",
      status: "unverified",
    }
  );
}
