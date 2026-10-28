"use client";
import { useState, type ReactNode } from "react";
import { Flame, Maximize2, Share2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AppDialog } from "@/components/ui/AppDialog";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProviderBrandIcon } from "../ModelBrandIcon";
import {
  activityStats,
  type StatisticsOverview,
  type StatisticsRank,
  type StatMetric,
} from "@/lib/settings/statistics";
import { cn } from "@/lib/utils";
import { SettingsDivider, SettingsGroup } from "./SettingsPrimitives";

export const formatStat = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("zh-CN").format(value);
export const compactStat = (value: number) =>
  value >= 1e6
    ? `${+(value / 1e6).toFixed(2)}M`
    : value >= 1e3
      ? `${+(value / 1e3).toFixed(1)}K`
      : formatStat(value);
export const durationStat = (value: number | null) =>
  value === null
    ? "—"
    : value >= 3600000
      ? `${+(value / 3600000).toFixed(1)} 小时`
      : value >= 60000
        ? `${+(value / 60000).toFixed(1)} 分钟`
        : `${+(value / 1000).toFixed(1)} 秒`;

export function StatisticCard({
  title,
  metric,
  value,
  description,
  extra,
}: {
  title: string;
  metric?: StatMetric;
  value?: string;
  description?: ReactNode;
  extra?: ReactNode;
}) {
  const growth =
    metric && metric.previous > 0
      ? ((metric.value - metric.previous) / metric.previous) * 100
      : null;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm font-medium text-gray-900 dark:text-gray-100 md:text-base">
        <span>{title}</span>
        {extra}
        {growth !== null && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            {growth >= 0 ? "+" : ""}
            {growth.toFixed(1)}%
          </span>
        )}
      </div>
      <div
        className="mt-2 truncate text-[30px] font-bold leading-[1.2] tabular-nums"
        data-markai-tooltip={metric ? formatStat(metric.value) : undefined}
      >
        {value ?? compactStat(metric?.value || 0)}
      </div>
      <div className="mt-4 text-xs leading-5 text-gray-400">
        {description ?? `截至上月 ${formatStat(metric?.previous ?? 0)}`}
      </div>
    </div>
  );
}

function RankList({ rows, topics = false }: { rows: StatisticsRank[]; topics?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={`${row.provider || ""}/${row.id}`}
          className="relative flex min-h-9 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-xs"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-md bg-gray-200/65 dark:bg-white/[0.08]"
            style={{ width: `${(row.count / max) * 100}%` }}
          />
          {row.provider && (
            <span className="relative shrink-0">
              <ProviderBrandIcon provider={row.provider} name={row.provider} size={16} />
            </span>
          )}
          {topics ? (
            <Link
              href={`/${row.id}`}
              className="relative min-w-0 flex-1 truncate"
              data-markai-tooltip={row.name}
            >
              {row.name}
            </Link>
          ) : (
            <span
              className="relative min-w-0 flex-1 truncate"
              data-markai-tooltip={`${row.name}${row.provider ? ` · ${row.provider}` : ""}`}
            >
              {row.name}
            </span>
          )}
          <span className="relative shrink-0 tabular-nums">{formatStat(row.count)}</span>
        </div>
      ))}
      {!rows.length && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-400">
          <span className="text-sm">暂无数据</span>
          <span className="text-xs">开始对话，记录你的 AI 使用足迹</span>
        </div>
      )}
    </div>
  );
}
function Ranking({
  title,
  rows,
  topics,
}: {
  title: string;
  rows: StatisticsRank[];
  topics?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium">{title}</h3>
        {rows.length > 5 && (
          <IconButton
            size="sm"
            aria-label={`展开${title}`}
            data-markai-tooltip="查看全部"
            onClick={() => setOpen(true)}
          >
            <Maximize2 size={15} />
          </IconButton>
        )}
      </div>
      <div className="mb-3 flex justify-between text-xs text-gray-400">
        <span>{topics ? "话题" : title.startsWith("模型") ? "模型" : "助手"}</span>
        <span>消息数</span>
      </div>
      <RankList rows={rows.slice(0, 5)} topics={topics} />
      <AppDialog open={open} onClose={() => setOpen(false)} title={title} width={560}>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <RankList rows={rows} topics={topics} />
        </div>
      </AppDialog>
    </section>
  );
}

export function StatisticsOverviewPanel({ data }: { data: StatisticsOverview }) {
  const [dimension, setDimension] = useState<"tokens" | "messages">("tokens");
  const stats = activityStats(data.activity, dimension);
  const tokenStats = activityStats(data.activity, "tokens");
  const offset = new Date(`${data.activity[0].date}T00:00:00Z`).getUTCDay();
  const weeks = Math.ceil((offset + data.activity.length) / 7);
  const [share, setShare] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `我的 MarkAI 使用统计\n使用 ${data.days} 天 · ${formatStat(data.metrics.topics.value)} 个话题\n${formatStat(data.metrics.messages.value)} 条消息 · ${formatStat(data.metrics.tokens.value)} Tokens`,
      );
      toast.success("统计摘要已复制");
    } catch {
      toast.error("复制失败，请重试");
    }
  };
  return (
    <SettingsGroup
      bodyClassName="py-4"
      title={
        <span className="font-medium">
          {data.name}，这是你与 MarkAI 相伴的第 <strong>{data.days || 1}</strong> 天
        </span>
      }
      description={`${data.createdAt ? `开始使用 ${data.createdAt.slice(0, 10)}` : "尚无使用记录"} · 最近活跃 ${data.lastActiveAt ? data.lastActiveAt.slice(0, 10) : "尚无记录"}`}
      extra={
        <IconButton
          aria-label="分享使用统计"
          data-markai-tooltip="分享统计摘要"
          onClick={() => setShare(true)}
        >
          <Share2 size={18} />
        </IconButton>
      }
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatisticCard
          title="助手"
          metric={data.metrics.assistants}
          description="内置 MarkAI 助手"
        />
        <StatisticCard title="话题" metric={data.metrics.topics} />
        <StatisticCard title="消息" metric={data.metrics.messages} />
        <StatisticCard title="累计 Tokens" metric={data.metrics.tokens} />
      </div>
      <SettingsDivider dashed />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-medium">过去一年的活动</h3>
          <SegmentedControl
            value={dimension}
            onChange={setDimension}
            options={[
              { value: "tokens", label: "Tokens" },
              { value: "messages", label: "消息" },
            ]}
          />
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-md bg-gray-100 px-2 py-1 dark:bg-white/5">
            {stats.active} 天
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
            <Flame size={12} />
            {stats.hot} 天
          </span>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 rounded-lg border border-gray-200 py-4 dark:border-white/10 sm:grid-cols-4">
        {[
          ["单日最高 Tokens", compactStat(tokenStats.peak)],
          ["最长任务", durationStat(data.longestTaskMs)],
          ["当前连续", `${tokenStats.current} 天`],
          ["最长连续", `${tokenStats.longest} 天`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border-[var(--settings-divider)] py-2 text-center sm:border-r sm:last:border-0"
          >
            <div className="text-xl font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-gray-400">{label}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[580px]">
          <div
            className="mb-2 grid text-[11px] text-gray-400"
            style={{ gridTemplateColumns: `repeat(${weeks},minmax(0,1fr))` }}
          >
            {Array.from({ length: weeks }, (_, week) => {
              const item = data.activity[Math.max(0, week * 7 - offset)];
              const first =
                week === 0 ||
                (item &&
                  item.date.slice(5, 7) !==
                    data.activity[Math.max(0, (week - 1) * 7 - offset)]?.date.slice(5, 7));
              return (
                <span key={week} className="whitespace-nowrap">
                  {first && item ? `${Number(item.date.slice(5, 7))}月` : ""}
                </span>
              );
            })}
          </div>
          <div
            className="grid grid-flow-col grid-rows-7 gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${weeks},minmax(0,1fr))` }}
            role="img"
            aria-label={`过去一年${dimension === "tokens" ? "Token" : "消息"}活动热力图，活跃 ${stats.active} 天`}
          >
            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {data.activity.map((d) => {
              const level =
                d[dimension] === 0
                  ? 0
                  : Math.max(1, Math.ceil((d[dimension] / Math.max(1, stats.peak)) * 4));
              return (
                <span
                  key={d.date}
                  className={cn(
                    "aspect-square max-h-[14px] rounded-[3px]",
                    [
                      "bg-gray-100 dark:bg-white/[0.06]",
                      "bg-emerald-200 dark:bg-emerald-900",
                      "bg-emerald-400 dark:bg-emerald-700",
                      "bg-emerald-600 dark:bg-emerald-500",
                      "bg-emerald-800 dark:bg-emerald-300",
                    ][level],
                  )}
                  data-markai-tooltip={`${d.date} · ${formatStat(d[dimension])} ${dimension === "tokens" ? "Tokens" : "条消息"}`}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span>按 UTC 日期统计</span>
        <div className="flex items-center gap-1.5">
          少
          {[
            "bg-gray-100 dark:bg-white/[0.06]",
            "bg-emerald-200",
            "bg-emerald-400",
            "bg-emerald-600",
            "bg-emerald-800",
          ].map((c) => (
            <span key={c} className={cn("size-3 rounded-sm", c)} />
          ))}
          多
        </div>
      </div>
      <SettingsDivider dashed />
      <div className="grid gap-6 lg:grid-cols-3">
        <Ranking title="模型排行" rows={data.ranks.models} />
        <Ranking title="助手排行" rows={data.ranks.assistants} />
        <Ranking title="话题排行" rows={data.ranks.topics} topics />
      </div>
      <AppDialog open={share} onClose={() => setShare(false)} title="分享使用统计" width={440}>
        <div className="space-y-5 p-5">
          <p className="text-sm text-gray-500">
            摘要仅包含累计数字，不包含对话内容或模型服务密钥。
          </p>
          <div className="grid grid-cols-2 gap-2">
            <StatisticCard
              title="话题"
              value={formatStat(data.metrics.topics.value)}
              description={`${data.days} 天相伴`}
            />
            <StatisticCard
              title="消息"
              value={formatStat(data.metrics.messages.value)}
              description={`${compactStat(data.metrics.tokens.value)} Tokens`}
            />
          </div>
          <button
            type="button"
            onClick={copy}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm text-white"
          >
            复制统计摘要
          </button>
        </div>
      </AppDialog>
    </SettingsGroup>
  );
}
