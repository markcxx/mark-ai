"use client";

import { Lightbulb } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatRankingValue, type RankedRow, type RankingMetric } from "@/lib/model-rankings";
import { cn } from "@/lib/utils";
import { RankingBarChart } from "./RankingBarChart";
import { VendorLogo } from "./VendorLogo";

export function RankingCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-gray-200/70 bg-[var(--chat-panel-bg)] p-4 md:p-5 dark:border-white/[0.07]",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {description && <p className="mt-1 text-[11px] leading-5 text-gray-400">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** One leaderboard card whose tabs switch between related metrics. */
export function RankingChart({
  title,
  metrics,
  rankFor,
  limit,
  emptyText,
}: {
  title?: string;
  metrics: RankingMetric[];
  rankFor: (metric: RankingMetric) => { rows: RankedRow[]; total: number };
  limit: number;
  emptyText: string;
}) {
  const [key, setKey] = useState(metrics[0].key);
  const metric = metrics.find((item) => item.key === key) || metrics[0];
  const { rows, total } = rankFor(metric);
  const visible = rows.slice(0, limit);
  return (
    <RankingCard
      title={title || metric.label}
      description={`${metric.description} 单位：${metric.unit}，${metric.lowerIsBetter ? "越低越好" : "越高越好"}。`}
      actions={
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {metrics.length > 1 && (
            <div className="-mx-1 max-w-full overflow-x-auto px-1">
              <SegmentedControl<string>
                value={metric.key}
                onChange={setKey}
                options={metrics.map((item) => ({ value: item.key, label: item.shortLabel }))}
                className="min-h-9 md:min-h-8"
              />
            </div>
          )}
          <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
            显示 {visible.length} / {total}
          </span>
        </div>
      }
    >
      {visible.length ? (
        <>
          <RankingBarChart metric={metric} rows={visible} />
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Lightbulb size={12} strokeWidth={1.8} />
            灯泡表示推理模型 · 同分并列 · 名称可跳转 AA 详情页
          </p>
          <RankingTable metric={metric} rows={rows} />
        </>
      ) : (
        <p className="flex min-h-64 items-center justify-center text-sm text-gray-500">
          {emptyText}
        </p>
      )}
    </RankingCard>
  );
}

function RankingTable({ metric, rows }: { metric: RankingMetric; rows: RankedRow[] }) {
  return (
    <details className="group mt-3 border-t border-gray-100 pt-1 dark:border-white/[0.07]">
      <summary className="flex min-h-11 cursor-pointer select-none items-center text-xs text-gray-500 hover:text-gray-900 md:min-h-9 dark:hover:text-gray-100">
        查看全部 {rows.length} 条数据
      </summary>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">
            {metric.label}，当前快照内的排名，单位{metric.unit}
          </caption>
          <thead className="sticky top-0 bg-[var(--chat-panel-bg)]">
            <tr className="text-gray-400">
              <th className="w-12 py-2 pr-3 font-normal">名次</th>
              <th className="py-2 font-normal">模型</th>
              <th className="hidden py-2 font-normal sm:table-cell">厂商</th>
              <th className="py-2 pl-3 text-right font-normal">{metric.unit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ model, vendor, rank, value }) => (
              <tr key={model.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                <td className="py-2.5 pr-3 font-jakarta tabular-nums text-gray-500">{rank}</td>
                <td className="py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <VendorLogo vendor={vendor} name={model.name} size={16} />
                    <span className="min-w-0 break-words">{model.name}</span>
                  </span>
                </td>
                <td className="hidden py-2.5 text-gray-500 sm:table-cell">{vendor.label}</td>
                <td className="whitespace-nowrap py-2.5 pl-3 text-right font-jakarta tabular-nums">
                  {formatRankingValue(value, metric.digits)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
