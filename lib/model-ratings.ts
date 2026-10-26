import type { ModelCapabilityScores, ModelRatings } from "./model-metadata";

export const CAPABILITY_AXES: {
  key: keyof ModelCapabilityScores;
  label: string;
  field: string;
}[] = [
  { key: "engineering", label: "工程", field: "artificial_analysis_engineering_index" },
  { key: "strategy", label: "战略运营", field: "artificial_analysis_strategy_and_ops_index" },
  { key: "finance", label: "财务会计", field: "artificial_analysis_finance_and_accounting_index" },
  { key: "economics", label: "经济学", field: "artificial_analysis_economics_index" },
  { key: "legal", label: "法律", field: "artificial_analysis_legal_index" },
  { key: "healthcare", label: "医疗", field: "artificial_analysis_healthcare_and_medical_index" },
];

const PRIMARY_AXES: { key: keyof ModelRatings; label: string }[] = [
  { key: "intelligence", label: "智能" },
  { key: "agentic", label: "Agentic" },
  { key: "coding", label: "编码" },
  { key: "speed", label: "速度" },
  { key: "price", label: "经济性" },
];

export function getModelRatingAxes(ratings: ModelRatings) {
  const available = (axis: { key: keyof ModelRatings }) =>
    typeof ratings[axis.key] === "number" && Number.isFinite(ratings[axis.key]);
  const selected = [...PRIMARY_AXES, ...CAPABILITY_AXES].filter(available).slice(0, 5);
  // Keep capability dimensions together, followed by speed and cost. Selection
  // uses a stable priority, never the model's best scores.
  const order = [...PRIMARY_AXES.slice(0, 3), ...CAPABILITY_AXES, ...PRIMARY_AXES.slice(3)].map(
    (axis) => axis.key,
  );
  return selected.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
