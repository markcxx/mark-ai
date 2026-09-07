"use client";

import type { EChartsOption } from "echarts";
import {
  Ban,
  Clock3,
  Files,
  HardDrive,
  MailWarning,
  MessageCircleMore,
  MessageSquareText,
  Send,
  Users,
  UserPlus,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { AdminChart } from "@/components/admin/AdminChart";
import { AdminError, formatBytes } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

type OverviewData = {
  fileTypes: Array<{ name: string; value: number }>;
  providerTypes: Array<{ name: string; value: number }>;
  rangeDays: number;
  refreshToken?: number;
  stats: {
    bannedUsers: number;
    emailDeliveryRate: number | null;
    failedEmails: number;
    fileBytes: number;
    files: number;
    messages: number;
    newUsers: number;
    pendingWaitlist: number;
    sessions: number;
    users: number;
    verifiedUsers: number;
  };
  activityTrend: Array<{ date: string; sessions: number }>;
  trend: Array<{
    date: string;
    files: number;
    messages: number;
    sessions: number;
    users: number;
  }>;
};

type OverviewPanelProps = {
  onRangeDaysChange?: (value: number) => void;
  rangeDays: number;
  refreshToken?: number;
};

const fileTypeLabels: Record<string, string> = {
  application: "文档与应用",
  audio: "音频",
  image: "图片",
  text: "文本",
  video: "视频",
};

const formatCount = (value: number) => new Intl.NumberFormat("zh-CN").format(Number(value) || 0);

const formatPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";

function SectionHeading({ description, title }: { description?: string; title: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
    </div>
  );
}

const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ActivityHeatmap({ trend }: { trend: OverviewData["activityTrend"] }) {
  const values = new Map(trend.map((item) => [item.date, item.sessions]));
  const firstDate = trend[0]?.date
    ? new Date(`${trend[0].date}T00:00:00Z`)
    : new Date();
  const lastDate = trend.at(-1)?.date
    ? new Date(`${trend.at(-1)?.date}T00:00:00Z`)
    : firstDate;

  const start = new Date(firstDate);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(lastDate);
  end.setUTCDate(end.getUTCDate() + (6 - ((end.getUTCDay() + 6) % 7)));
  const weekCount = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
  );
  const weeks = Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + weekIndex * 7 + dayIndex);
      return date;
    }),
  );
  const maxValue = Math.max(1, ...trend.map((item) => item.sessions));
  const gridStyle = { gridTemplateColumns: `22px repeat(${weekCount}, 14px)` };

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid w-max gap-1" style={gridStyle}>
        <span aria-hidden="true" />
        {weeks.map((week, index) => {
          const monthChanged = index === 0 || week[0].getUTCMonth() !== weeks[index - 1][0].getUTCMonth();
          return (
            <span className="truncate text-[10px] text-gray-400" key={dateKey(week[0])}>
              {monthChanged ? `${week[0].getUTCMonth() + 1}月` : ""}
            </span>
          );
        })}
        {weekdayLabels.map((label, rowIndex) => (
          <Fragment key={label}>
            <span className="self-center text-[10px] text-gray-400">{label}</span>
            {weeks.map((week) => {
              const key = dateKey(week[rowIndex]);
              const value = values.get(key);
              const intensity =
                typeof value === "number" && value > 0 ? 0.12 + 0.88 * (value / maxValue) : 0;
              const description =
                typeof value === "number" && value > 0 ? `${formatCount(value)} 个新对话` : "暂无数据";
              return (
                <span
                  aria-label={`${key}：${description}`}
                  className={cn(
                    "h-3.5 w-3.5 rounded-[2px] border",
                    intensity > 0
                      ? "border-transparent"
                      : "border-gray-100 bg-gray-50 dark:border-white/[0.06] dark:bg-white/[0.025]",
                  )}
                  key={key}
                  style={intensity > 0 ? { backgroundColor: `rgba(37, 99, 235, ${intensity})` } : undefined}
                  title={`${key}：${description}`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-3 flex w-max items-center gap-1.5 text-[10px] text-gray-400">
        <span>低活跃</span>
        {["bg-gray-100 dark:bg-white/[0.06]", "bg-blue-100", "bg-blue-300", "bg-blue-600"].map((color) => (
          <span className={cn("h-2.5 w-2.5 rounded-[2px]", color)} key={color} />
        ))}
        <span>高活跃</span>
      </div>
    </div>
  );
}

export function OverviewPanel({ onRangeDaysChange, rangeDays, refreshToken = 0 }: OverviewPanelProps) {
  const [data, setData] = useState<OverviewData>();
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(
        `/api/admin/overview?days=${rangeDays}&refresh=${refreshToken}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "概览数据加载失败");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "概览数据加载失败");
    }
  }, [rangeDays, refreshToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const trendOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 260,
      dataZoom: [{ end: 100, start: rangeDays === 30 ? 20 : 0, type: "inside" }],
      grid: { bottom: 28, containLabel: true, left: 8, right: 8, top: 30 },
      legend: {
        data: ["新增用户", "对话", "消息"],
        left: 0,
        itemHeight: 7,
        itemWidth: 18,
        itemGap: 18,
        textStyle: { color: "#9ca3af", fontSize: 11 },
        top: 0,
      },
      series: [
        {
          data: data?.trend.map((item) => item.users) || [],
          emphasis: { focus: "series" },
          itemStyle: { color: "#2563eb" },
          lineStyle: { color: "#2563eb", width: 1.6 },
          name: "新增用户",
          showSymbol: rangeDays <= 14,
          smooth: 0.18,
          symbol: "circle",
          symbolSize: 4,
          type: "line",
        },
        {
          data: data?.trend.map((item) => item.sessions) || [],
          emphasis: { focus: "series" },
          itemStyle: { color: "#6b7280" },
          lineStyle: { color: "#6b7280", width: 1.4 },
          name: "对话",
          showSymbol: rangeDays <= 14,
          smooth: 0.18,
          symbol: "circle",
          symbolSize: 4,
          type: "line",
        },
        {
          data: data?.trend.map((item) => item.messages) || [],
          emphasis: { focus: "series" },
          itemStyle: { color: "#c1c7d0" },
          lineStyle: { color: "#c1c7d0", width: 1.4 },
          name: "消息",
          showSymbol: rangeDays <= 14,
          smooth: 0.18,
          symbol: "circle",
          symbolSize: 4,
          type: "line",
          yAxisIndex: 1,
        },
      ],
      tooltip: {
        axisPointer: { type: "line" },
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#e5e7eb",
        textStyle: { color: "#111827", fontSize: 12 },
        trigger: "axis",
      },
      xAxis: {
        axisLabel: { color: "#9ca3af", fontSize: 11 },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisTick: { show: false },
        data: data?.trend.map((item) => item.date.slice(5)) || [],
        type: "category",
      },
      yAxis: [
        {
          axisLabel: { color: "#9ca3af", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          minInterval: 1,
          splitLine: { lineStyle: { color: "#eef0f2", type: "dashed" } },
          type: "value",
        },
        {
          axisLabel: { color: "#c1c7d0", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          minInterval: 1,
          splitLine: { show: false },
          type: "value",
        },
      ],
    }),
    [data, rangeDays],
  );

  const metrics = data
    ? [
        { icon: Users, label: "全部用户", value: formatCount(data.stats.users) },
        {
          icon: UserPlus,
          label: `近 ${rangeDays} 天新增`,
          value: formatCount(data.stats.newUsers),
        },
        { icon: MessageCircleMore, label: "全部对话", value: formatCount(data.stats.sessions) },
        { icon: MessageSquareText, label: "全部消息", value: formatCount(data.stats.messages) },
        { icon: Files, label: "存储文件", value: formatCount(data.stats.files) },
        { icon: HardDrive, label: "已用空间", value: formatBytes(data.stats.fileBytes) },
      ]
    : [];

  const providerTotal = (data?.providerTypes || []).reduce(
    (total, item) => total + Number(item.value || 0),
    0,
  );
  const fileTotal = (data?.fileTypes || []).reduce((total, item) => total + Number(item.value || 0), 0);
  const providers = (data?.providerTypes || []).slice(0, 5);
  const fileTypes = (data?.fileTypes || []).slice().sort((a, b) => b.value - a.value);
  const reminders = data
    ? [
        {
          icon: Clock3,
          label: "待审批",
          tone: "text-amber-500",
          value: formatCount(data.stats.pendingWaitlist),
        },
        {
          icon: MailWarning,
          label: "失败邮件",
          tone: "text-red-500",
          value: formatCount(data.stats.failedEmails),
        },
        {
          icon: Ban,
          label: "已封禁用户",
          tone: "text-gray-500",
          value: formatCount(data.stats.bannedUsers),
        },
        {
          icon: Send,
          label: "邮件投递",
          tone: "text-emerald-500",
          value:
            data.stats.emailDeliveryRate === null
              ? "暂无记录"
              : `${data.stats.emailDeliveryRate.toFixed(1)}%`,
        },
      ]
    : [];

  if (error) return <AdminError message={error} onRetry={() => void load()} />;

  if (!data) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-5 w-28 rounded bg-gray-100 dark:bg-white/[0.06]" />
        <div className="h-[74px] rounded-lg bg-gray-50 dark:bg-white/[0.035]" />
        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="h-[330px] rounded-lg bg-gray-50 dark:bg-white/[0.035]" />
          <div className="h-[330px] rounded-lg bg-gray-50 dark:bg-white/[0.035]" />
        </div>
        <div className="h-[250px] rounded-lg bg-gray-50 dark:bg-white/[0.035]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-7 md:space-y-8">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <div>
          <h3 className="text-sm font-semibold">运营数据</h3>
          <p className="mt-1 text-xs text-gray-400">查看用户与系统运行情况</p>
        </div>
        <div className="shrink-0">
          <select
            aria-label="概览时间范围"
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none dark:border-white/10 dark:bg-[#191919] dark:text-gray-200"
            onChange={(event) => onRangeDaysChange?.(Number(event.target.value))}
            value={rangeDays}
          >
            <option value={7}>7 天</option>
            <option value={14}>14 天</option>
            <option value={30}>30 天</option>
          </select>
        </div>
      </div>

      <section>
        <SectionHeading description="关键指标总览，了解平台整体运营状况" title="运营数据" />
        <div className="grid grid-cols-2 border-y border-gray-200/80 sm:grid-cols-3 xl:grid-cols-6 dark:border-white/[0.09]">
          {metrics.map(({ icon: Icon, label, value }) => (
            <div
              className="flex min-w-0 items-center gap-2.5 px-2 py-3.5 sm:px-3.5 xl:border-l xl:border-gray-200/60 xl:first:border-l-0 dark:border-white/[0.09]"
              key={label}
            >
              <Icon className="shrink-0 text-gray-400" size={16} strokeWidth={1.7} />
              <div className="min-w-0">
                <p className="truncate text-xs text-gray-400">{label}</p>
                <p className="mt-0.5 truncate font-jakarta text-[18px] font-semibold leading-6 text-gray-900 dark:text-gray-100">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-7 border-b border-gray-200/80 pb-7 xl:grid-cols-[1.7fr_1fr] dark:border-white/[0.09]">
        <div className="min-w-0">
          <SectionHeading description="新增用户数、对话数与消息数的趋势对比" title="用户与使用趋势" />
          <AdminChart height={286} mobileHeight={250} option={trendOption} />
        </div>
        <div className="min-w-0">
          <SectionHeading description="需要关注的关键事项" title="运营提醒" />
          <div className="overflow-hidden rounded-lg border border-gray-200/80 dark:border-white/[0.1]">
            {reminders.map(({ icon: Icon, label, tone, value }) => (
              <div
                className="flex h-[58px] items-center gap-3 border-b border-gray-200/80 px-3.5 last:border-b-0 dark:border-white/[0.09]"
                key={label}
              >
                <Icon className={tone} size={17} strokeWidth={1.7} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                  {label}
                </span>
                <span className={`shrink-0 font-jakarta text-sm font-medium ${tone}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-7 xl:grid-cols-3 xl:gap-0">
        <div className="min-w-0 xl:pr-7">
          <SectionHeading description="按对话数统计 Top 5" title="模型服务商" />
          <div className="space-y-3">
            {providers.map((item, index) => (
              <div className="flex items-center gap-2 text-xs" key={item.name || index}>
                <span className="w-4 shrink-0 text-gray-400">{index + 1}</span>
                <span className="w-20 shrink-0 truncate text-gray-700 dark:text-gray-300">
                  {item.name || "未知"}
                </span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.1]">
                  <div
                    className={`h-full rounded-full ${index < 3 ? "bg-blue-600" : "bg-gray-400 dark:bg-gray-500"}`}
                    style={{ width: `${providerTotal ? (item.value / Math.max(...providers.map((entry) => entry.value))) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums text-gray-400">
                  {formatPercent(item.value, providerTotal)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 border-t border-gray-200/80 pt-7 xl:border-l xl:border-t-0 xl:px-7 xl:pt-0 dark:border-white/[0.09]">
          <SectionHeading description="按存储容量统计" title="文件存储" />
          <div className="space-y-3">
            {fileTypes.map((item) => (
              <div className="flex items-center gap-3 text-xs" key={item.name}>
                <span className="w-16 shrink-0 truncate text-gray-700 dark:text-gray-300">
                  {fileTypeLabels[item.name] || item.name}
                </span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.1]">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${fileTotal ? (item.value / Math.max(...fileTypes.map((entry) => entry.value))) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right tabular-nums text-gray-400">
                  {formatPercent(item.value, fileTotal)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 border-t border-gray-200/80 pt-7 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0 dark:border-white/[0.09]">
          <SectionHeading description="过去 3 个月活跃用户热力图" title="每日活跃" />
          <ActivityHeatmap trend={data.activityTrend} />
        </div>
      </section>
    </div>
  );
}
