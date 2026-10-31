import { Lightbulb } from "lucide-react";
import {
  formatRankingValue,
  niceScale,
  shortModelName,
  type RankedRow,
  type RankingMetric,
} from "@/lib/model-rankings";
import { VendorLogo } from "./VendorLogo";

const PLOT_HEIGHT = 300;
const COLUMN = 58;
const BAR = 46;
// Rotated labels extend left of their bar; reserve room so the first one stays visible.
const PAD_LEFT = 76;
const PAD_RIGHT = 12;
const INSIDE_LABEL_MIN = 34;

/** Vertical leaderboard bars in vendor colors, after the AA index chart. */
export function RankingBarChart({ metric, rows }: { metric: RankingMetric; rows: RankedRow[] }) {
  const { max, step } = niceScale(Math.max(...rows.map((row) => row.value), 0));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step);
  const width = PAD_LEFT + rows.length * COLUMN + PAD_RIGHT;
  return (
    <div
      className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-2 md:-mx-5 md:px-5"
      tabIndex={0}
      role="region"
      aria-label={`${metric.label}柱状图，可横向滚动；完整数值见下方数据表`}
    >
      <div className="relative" style={{ width, minWidth: "100%" }}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: PLOT_HEIGHT }}
        >
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 flex items-center"
              style={{ bottom: `${(tick / max) * 100}%` }}
            >
              <span
                className="shrink-0 translate-y-px pr-2 text-right font-jakarta text-[10px] tabular-nums text-gray-400"
                style={{ width: PAD_LEFT - 16 }}
              >
                {formatRankingValue(tick, metric.digits)}
              </span>
              <span
                className={
                  tick === 0
                    ? "flex-1 border-t border-gray-300 dark:border-white/20"
                    : "flex-1 border-t border-dashed border-gray-200 dark:border-white/[0.08]"
                }
              />
            </div>
          ))}
        </div>
        <ol className="relative flex" style={{ paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT }}>
          {rows.map(({ model, vendor, value, rank, reasoning }) => {
            const height = max ? (value / max) * PLOT_HEIGHT : 0;
            const inside = height >= INSIDE_LABEL_MIN;
            const label = formatRankingValue(value, metric.digits);
            const name = shortModelName(model.name);
            return (
              <li
                key={model.id}
                className="group relative flex shrink-0 flex-col items-center"
                style={{ width: COLUMN }}
              >
                <div
                  className="flex w-full items-end justify-center"
                  style={{ height: PLOT_HEIGHT }}
                >
                  <div
                    className="relative flex justify-center rounded-t-md bg-[var(--bar)] transition-[height,filter] duration-500 ease-out group-hover:brightness-110 dark:bg-[var(--bar-dark)]"
                    style={
                      {
                        width: BAR,
                        height: Math.max(height, value > 0 ? 2 : 0),
                        "--bar": vendor.color,
                        "--bar-dark": vendor.darkColor || vendor.color,
                      } as React.CSSProperties
                    }
                  >
                    <span
                      className={
                        inside
                          ? "pt-2.5 font-jakarta text-[13px] font-medium tabular-nums text-white dark:text-[var(--bar-text)]"
                          : "absolute bottom-full pb-1 font-jakarta text-xs font-medium tabular-nums text-gray-700 dark:text-gray-200"
                      }
                      style={{ "--bar-text": vendor.darkText || "#fff" } as React.CSSProperties}
                    >
                      {label}
                    </span>
                  </div>
                </div>
                <div className="flex h-9 items-end justify-center">
                  <VendorLogo vendor={vendor} name={model.name} size={22} />
                </div>
                <div className="flex h-6 items-center justify-center text-gray-400">
                  {reasoning && <Lightbulb aria-label="推理模型" size={14} strokeWidth={1.8} />}
                </div>
                <div className="relative h-[124px] w-full">
                  <a
                    href={`https://artificialanalysis.ai/models/${encodeURIComponent(model.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`第 ${rank} 名 ${model.name}，${label} ${metric.unit}`}
                    data-markai-tooltip={`#${rank} · ${model.name} · ${label} ${metric.unit}`}
                    className="absolute right-1/2 top-1 block max-w-[150px] origin-top-right -rotate-45 truncate whitespace-nowrap rounded-sm font-jakarta text-xs leading-5 text-gray-700 hover:text-gray-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:text-gray-300 dark:hover:text-white"
                  >
                    {name}
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
