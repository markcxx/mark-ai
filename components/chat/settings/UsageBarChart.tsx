"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export type UsageChartData = {
  categories: { key: string; label: string }[];
  days: { date: string; values: number[] }[];
};
const colors = [
  "#007bff",
  "#f0a000",
  "#16a34a",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#a3a3a3",
];
const format = (value: number) => new Intl.NumberFormat("zh-CN").format(value);
const axisFormat = (value: number) =>
  value >= 1000000
    ? `${+(value / 1000000).toFixed(1)}M`
    : value >= 1000
      ? `${+(value / 1000).toFixed(1)}K`
      : format(value);
function axisMaximum(value: number) {
  if (value <= 0) return 5;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

/** Pointer, touch and keyboard interactions share the same structured tooltip. */
export function UsageBarChart({ categories, days }: UsageChartData) {
  const tooltipId = useId();
  const plot = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(600);
  useEffect(() => {
    const node = plot.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setPlotWidth(node.clientWidth));
    observer.observe(node);
    setPlotWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);
  const [active, setActive] = useState<{
    index: number;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = categories
    .map((c, i) => ({ ...c, index: i }))
    .filter((c) => !hidden.includes(c.key));
  const totalFor = (values: number[]) =>
    visible.reduce((sum, c) => sum + (values[c.index] || 0), 0);
  const max = axisMaximum(Math.max(0, ...days.map((d) => totalFor(d.values))));
  const day = active ? days[active.index] : undefined;
  const show = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width - 1, event.clientX - bounds.left));
    setActive({
      index: Math.min(days.length - 1, Math.floor((x / bounds.width) * days.length)),
      x,
      y: Math.max(0, event.clientY - bounds.top),
      width: bounds.width,
    });
  };
  const tooltipWidth = active ? Math.min(300, active.width) : 300;
  const tooltipLeft = active
    ? Math.max(
        0,
        Math.min(
          active.x + 20 + tooltipWidth > active.width
            ? active.x - tooltipWidth - 16
            : active.x + 20,
          active.width - tooltipWidth,
        ),
      )
    : 0;
  const labelStep = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(plotWidth / 95))));
  return (
    <div className="min-w-0">
      <div className="mb-4 flex min-h-6 flex-wrap justify-end gap-x-4 gap-y-2">
        {categories.map((c, i) => (
          <button
            type="button"
            key={c.key}
            aria-pressed={!hidden.includes(c.key)}
            onClick={() =>
              setHidden((value) =>
                value.includes(c.key) ? value.filter((k) => k !== c.key) : [...value, c.key],
              )
            }
            className={cn(
              "inline-flex min-h-8 max-w-full items-center gap-1.5 text-xs text-gray-500",
              hidden.includes(c.key) && "opacity-35",
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="max-w-[220px] truncate" data-markai-tooltip={c.label}>
              {c.label}
            </span>
          </button>
        ))}
      </div>
      <div className="flex h-[280px] min-w-0 gap-3 sm:h-[300px]">
        <div className="flex w-9 shrink-0 flex-col justify-between pb-7 text-right text-xs tabular-nums text-gray-400">
          {[1, 0.8, 0.6, 0.4, 0.2, 0].map((n) => (
            <span key={n}>{axisFormat(Math.round(max * n))}</span>
          ))}
        </div>
        <div ref={plot} className="relative min-w-0 flex-1 pb-7">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-7 top-0 flex flex-col justify-between"
            aria-hidden="true"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="border-t border-[var(--settings-divider)]" />
            ))}
          </div>
          <div
            role="group"
            aria-label="每日 Token 用量，使用左右方向键查看日期"
            tabIndex={0}
            className="relative flex h-full min-w-0 touch-pan-y items-end outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            onPointerMove={show}
            onPointerDown={show}
            onPointerLeave={() => setActive(null)}
            onFocus={(event) => {
              const width = event.currentTarget.getBoundingClientRect().width;
              setActive({ index: days.length - 1, x: width - 1, y: 80, width });
            }}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setActive(null);
                return;
              }
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const width = event.currentTarget.getBoundingClientRect().width;
              const index =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? days.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          days.length - 1,
                          (active?.index ?? days.length - 1) + (event.key === "ArrowLeft" ? -1 : 1),
                        ),
                      );
              setActive({ index, x: ((index + 0.5) / days.length) * width, y: 80, width });
            }}
            aria-describedby={active ? tooltipId : undefined}
          >
            {days.map((d, i) => (
              <div
                key={d.date}
                className={cn(
                  "relative flex h-full min-w-0 flex-1 flex-col-reverse justify-start px-[2px] transition-colors",
                  active?.index === i && "bg-black/[0.035] dark:bg-white/[0.04]",
                )}
              >
                {visible.map((c) => (
                  <div
                    key={c.key}
                    className="mx-auto w-full max-w-8"
                    style={{
                      height: `${((d.values[c.index] || 0) / max) * 100}%`,
                      backgroundColor: colors[c.index % colors.length],
                    }}
                  />
                ))}
              </div>
            ))}
            {day && active && (
              <div
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute z-30 overflow-hidden rounded-xl border border-black/[0.06] bg-[var(--chat-popover-bg)] text-sm shadow-[0_12px_28px_rgba(0,0,0,0.14)] dark:border-white/10"
                style={{
                  width: tooltipWidth,
                  left: tooltipLeft,
                  top: Math.max(0, Math.min(active.y - 90, 240 - Math.min(visible.length, 8) * 24)),
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[var(--settings-divider)] px-4 py-2.5">
                  <span>{day.date}</span>
                  <span className="font-semibold tabular-nums">{format(totalFor(day.values))}</span>
                </div>
                <div className="space-y-1 px-4 py-2.5">
                  {visible.map((c) => (
                    <div
                      key={c.key}
                      className="flex items-center gap-2 text-gray-500 dark:text-gray-400"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colors[c.index % colors.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      <span className="shrink-0 tabular-nums text-gray-900 dark:text-gray-100">
                        {format(day.values[c.index] || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div
            className="absolute inset-x-0 bottom-0 h-5 text-[10px] leading-5 text-gray-400 sm:text-xs"
            aria-hidden="true"
          >
            {days
              .map((d, i) => ({ ...d, index: i }))
              .filter((d) => d.index % labelStep === 0)
              .map((d) => (
                <span
                  key={d.date}
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{
                    left: `clamp(34px, ${((d.index + 0.5) / days.length) * 100}%, calc(100% - 34px))`,
                  }}
                >
                  {d.date}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
