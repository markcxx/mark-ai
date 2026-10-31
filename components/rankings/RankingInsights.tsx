import { CAPABILITY_AXES } from "@/lib/model-ratings";
import {
  baseModelName,
  formatRankingValue,
  getRankingVendor,
  shortModelName,
  type RankedRow,
  type RankingModel,
} from "@/lib/model-rankings";
import { VendorLogo } from "./VendorLogo";

/** Best model of each vendor on the intelligence index, as horizontal bars. */
export function VendorLeaderboard({ rows }: { rows: RankedRow[] }) {
  const seen = new Map<string, { row: RankedRow; count: number }>();
  for (const row of rows) {
    if (row.vendor.key === "other") continue;
    const entry = seen.get(row.vendor.key);
    if (entry) entry.count += 1;
    else seen.set(row.vendor.key, { row, count: 1 });
  }
  const vendors = [...seen.values()].slice(0, 12);
  const maximum = Math.max(...vendors.map(({ row }) => row.value), 1);
  if (!vendors.length)
    return <p className="py-10 text-center text-sm text-gray-500">暂无厂商数据</p>;
  return (
    <ol className="space-y-2.5">
      {vendors.map(({ row, count }, index) => (
        <li key={row.vendor.key} className="flex min-w-0 items-center gap-3">
          <span className="w-4 shrink-0 text-right font-jakarta text-[11px] tabular-nums text-gray-400">
            {index + 1}
          </span>
          <VendorLogo vendor={row.vendor} size={18} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {row.vendor.label}
                </span>
                <span
                  className="ml-2 font-jakarta text-[11px] text-gray-400"
                  data-markai-tooltip={row.model.name}
                >
                  {shortModelName(row.model.name)}
                </span>
              </span>
              <span className="shrink-0 font-jakarta font-semibold tabular-nums">
                {formatRankingValue(row.value, 1)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[var(--bar)] transition-[width] duration-500 dark:bg-[var(--bar-dark)]"
                style={
                  {
                    width: `${(row.value / maximum) * 100}%`,
                    "--bar": row.vendor.color,
                    "--bar-dark": row.vendor.darkColor || row.vendor.color,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
          <span className="hidden w-14 shrink-0 text-right text-[11px] tabular-nums text-gray-400 sm:block">
            {count} 个版本
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Domain capability scores of the strongest models. Cell shading compares a
 * score against its own column so independent indices are never summed.
 */
export function CapabilityMatrix({
  models,
  limit = 12,
  query = "",
  vendor,
}: {
  models: RankingModel[];
  limit?: number;
  query?: string;
  vendor?: string;
}) {
  const search = query.trim().toLowerCase();
  const complete = models.filter((model) =>
    CAPABILITY_AXES.some((axis) => typeof model.capabilities?.[axis.key] === "number"),
  );
  // Columns flagged as each model's strongest domain make relative strengths readable.
  const best = (model: RankingModel) =>
    CAPABILITY_AXES.reduce<{ key?: string; value: number }>(
      (current, axis) => {
        const value = model.capabilities?.[axis.key];
        return typeof value === "number" && value > current.value
          ? { key: axis.key, value }
          : current;
      },
      { value: -1 },
    ).key;
  // One row per model family: keep its highest-intelligence variant.
  const families = new Map<string, RankingModel>();
  for (const model of complete) {
    const key = baseModelName(model.name).toLowerCase();
    const current = families.get(key);
    if (!current || (model.intelligence ?? -1) > (current.intelligence ?? -1))
      families.set(key, model);
  }
  const rows = [...families.values()]
    .filter(
      (model) =>
        (!vendor || getRankingVendor(model).key === vendor) &&
        `${model.name} ${model.slug}`.toLowerCase().includes(search),
    )
    .sort((a, b) => (b.intelligence ?? -1) - (a.intelligence ?? -1))
    .slice(0, limit);
  if (!rows.length)
    return <p className="py-10 text-center text-sm text-gray-500">没有匹配的专业能力评测数据</p>;
  return (
    <div>
      <HeatLegend />
      <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
        <table className="w-full min-w-[680px] border-separate border-spacing-1 text-xs">
          <caption className="sr-only">
            专业能力指数矩阵，颜色越深分数越高，星标为该模型最强领域
          </caption>
          <thead>
            <tr className="text-gray-400">
              <th className="pb-1 text-left font-normal">模型</th>
              {CAPABILITY_AXES.map((axis) => (
                <th key={axis.key} className="w-[10%] pb-1 text-center font-normal">
                  {axis.label}
                </th>
              ))}
              <th className="w-[9%] pb-1 text-center font-normal">平均</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((model) => {
              const modelVendor = getRankingVendor(model);
              const strongest = best(model);
              const scores = CAPABILITY_AXES.flatMap((axis) => {
                const value = model.capabilities?.[axis.key];
                return typeof value === "number" ? [value] : [];
              });
              const average = scores.length
                ? scores.reduce((sum, value) => sum + value, 0) / scores.length
                : undefined;
              return (
                <tr key={model.id}>
                  <td className="max-w-0 pr-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <VendorLogo vendor={modelVendor} name={model.name} size={16} />
                      <span
                        className="truncate font-jakarta text-gray-800 dark:text-gray-200"
                        data-markai-tooltip={model.name}
                      >
                        {shortModelName(model.name)}
                      </span>
                    </span>
                  </td>
                  {CAPABILITY_AXES.map((axis) => {
                    const value = model.capabilities?.[axis.key];
                    if (typeof value !== "number")
                      return (
                        <td
                          key={axis.key}
                          className="h-9 rounded-md text-center text-gray-300 dark:text-gray-600"
                        >
                          —
                        </td>
                      );
                    return (
                      <td
                        key={axis.key}
                        className="relative h-9 rounded-md text-center font-jakarta font-medium tabular-nums"
                        style={heatStyle(value)}
                      >
                        {formatRankingValue(value, 1)}
                        {strongest === axis.key && (
                          <span
                            aria-label="最强领域"
                            className="absolute right-1 top-0.5 text-[9px] leading-none opacity-80"
                          >
                            ★
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="h-9 text-center font-jakarta font-semibold tabular-nums text-gray-700 dark:text-gray-200">
                    {average === undefined ? "—" : formatRankingValue(average, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Absolute 0–70 scale shared by every domain index: color means the same score
// everywhere, unlike per-column normalization, which hid real differences.
const HEAT_STOPS = [
  { at: 0, color: [239, 246, 255] },
  { at: 30, color: [191, 219, 254] },
  { at: 45, color: [96, 165, 250] },
  { at: 55, color: [37, 99, 235] },
  { at: 65, color: [30, 58, 138] },
];

function heatColor(value: number) {
  const upper = HEAT_STOPS.findIndex((stop) => stop.at >= value);
  if (upper <= 0) return HEAT_STOPS[upper === 0 ? 0 : HEAT_STOPS.length - 1].color;
  const a = HEAT_STOPS[upper - 1];
  const b = HEAT_STOPS[upper];
  const t = (value - a.at) / (b.at - a.at);
  return a.color.map((channel, index) => Math.round(channel + (b.color[index] - channel) * t));
}

const heatStyle = (value: number) => {
  const [r, g, b] = heatColor(value);
  return {
    background: `rgb(${r} ${g} ${b})`,
    color: value >= 48 ? "#fff" : "#1e3a8a",
  };
};

function HeatLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-400">
      <span className="flex items-center gap-2">
        低
        <span
          className="h-2 w-28 rounded-full"
          style={{
            background: `linear-gradient(to right, ${HEAT_STOPS.map(
              (stop) => `rgb(${stop.color.join(" ")}) ${(stop.at / 65) * 100}%`,
            ).join(", ")})`,
          }}
        />
        高
      </span>
      <span>颜色越深分数越高（0–65+ 统一刻度）</span>
      <span>★ 该模型最强的领域</span>
    </div>
  );
}
