"use client";

import {
  RefreshCw,
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
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { IconButton } from "@/components/ui/IconButton";
import { OverviewDistributionChart } from "./OverviewDistributionChart";
import { UsageTrendChart } from "@/components/admin/UsageTrendChart";
import { AdminError, formatBytes } from "@/components/admin/AdminPrimitives";
import type { ReactNode } from "react";
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
  onRefresh?: () => void;
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

function DashboardCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-gray-200/60 bg-white p-4 md:p-5 dark:border-white/[0.07] dark:bg-[#191919]",
        className,
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1 text-[11px] text-gray-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ActivityHeatmap({ trend }: { trend: OverviewData["activityTrend"] }) {
  const values = new Map(trend.map((item) => [item.date, item.sessions]));
  const firstDate = trend[0]?.date ? new Date(`${trend[0].date}T00:00:00Z`) : new Date();
  const lastDate = trend.at(-1)?.date ? new Date(`${trend.at(-1)?.date}T00:00:00Z`) : firstDate;

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
          const monthChanged =
            index === 0 || week[0].getUTCMonth() !== weeks[index - 1][0].getUTCMonth();
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
                typeof value === "number" && value > 0
                  ? `${formatCount(value)} 个新对话`
                  : "暂无数据";
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
                  style={
                    intensity > 0
                      ? { backgroundColor: `rgba(112, 182, 163, ${intensity})` }
                      : undefined
                  }
                  data-markai-tooltip={`${key}：${description}`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-3 flex w-max items-center gap-1.5 text-[10px] text-gray-400">
        <span>低活跃</span>
        {["bg-gray-100 dark:bg-white/[0.06]", "bg-[#d6eae3]", "bg-[#a5d0c1]", "bg-[#70b6a3]"].map(
          (color) => (
            <span className={cn("h-2.5 w-2.5 rounded-[2px]", color)} key={color} />
          ),
        )}
        <span>高活跃</span>
      </div>
    </div>
  );
}

export function OverviewPanel({
  onRefresh,
  onRangeDaysChange,
  rangeDays,
  refreshToken = 0,
}: OverviewPanelProps) {
  const [data, setData] = useState<OverviewData>();
  const [error, setError] = useState("");

  const requestRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = `${rangeDays}:${refreshToken}`;
  const busy = loading || loadedKey !== requestKey;

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/overview?days=${rangeDays}&refresh=${refreshToken}`,
        { cache: "no-store", signal: controller.signal },
      );
      const result = await response.json();
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (!response.ok) throw new Error(result.error || "概览数据加载失败");
      setData(result);
      setLoadedKey(`${rangeDays}:${refreshToken}`);
    } catch (loadError) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setError(loadError instanceof Error ? loadError.message : "概览数据加载失败");
    } finally {
      if (!controller.signal.aborted && requestRef.current === controller) setLoading(false);
    }
  }, [rangeDays, refreshToken]);

  useEffect(() => {
    void load();
    return () => requestRef.current?.abort();
  }, [load]);

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

  const providers = (data?.providerTypes || []).slice(0, 6);
  const fileTypes = (data?.fileTypes || [])
    .map((item) => ({ ...item, name: fileTypeLabels[item.name] || item.name }))
    .sort((a, b) => b.value - a.value);
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

  const periodMessages = data.trend.reduce((sum, day) => sum + day.messages, 0);
  const periodSessions = data.trend.reduce((sum, day) => sum + day.sessions, 0);
  const averageDepth = periodSessions ? (periodMessages / periodSessions).toFixed(1) : "—";
  const verifiedRate = data.stats.users
    ? ((data.stats.verifiedUsers / data.stats.users) * 100).toFixed(1)
    : "0.0";
  const tones = [
    "bg-[#e8f3ed] text-gray-900 dark:bg-[#d4f77d] dark:text-[#202710]",
    "bg-[#eeeafa] text-gray-900 dark:bg-[#b4a0ef] dark:text-[#241b3a]",
    "bg-[#faf2e2] text-gray-900 dark:bg-[#f0c777] dark:text-[#322710]",
    "bg-[#242424] text-white dark:bg-[#191919] dark:text-gray-100",
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-jakarta text-[10px] font-semibold tracking-[.15em] text-gray-400">
            WORKSPACE ANALYTICS
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">运营概览</h2>
          <p className="mt-1 text-xs text-gray-500">从使用趋势到资源分布，了解 MarkAI 的运行情况</p>
        </div>
        <div className="flex shrink-0 items-center gap-2" aria-label="概览时间范围">
          <SegmentedControl
            className="min-h-11 md:min-h-8 [&_button]:min-h-10 md:[&_button]:min-h-7"
            onChange={onRangeDaysChange}
            options={[
              { label: "7 天", value: 7 },
              { label: "14 天", value: 14 },
              { label: "30 天", value: 30 },
            ]}
            padding={3}
            value={rangeDays}
          />
          <IconButton
            aria-label="刷新概览数据"
            data-markai-tooltip="刷新概览数据"
            onClick={onRefresh}
            shape="rounded"
            size="sm"
          >
            <RefreshCw size={16} className={busy ? "animate-spin" : undefined} />
          </IconButton>
        </div>
      </div>
      {busy ? (
        <div
          role="status"
          aria-live="polite"
          aria-label="正在加载概览数据"
          className="space-y-4 animate-pulse"
        >
          <p className="text-xs text-gray-500">正在加载近 {rangeDays} 天的数据…</p>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {tones.map((tone) => (
              <div key={tone} className={cn("h-[150px] rounded-xl", tone)} />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            <div className="h-[390px] rounded-xl bg-white dark:bg-[#191919]" />
            <div className="h-[390px] rounded-xl bg-white dark:bg-[#191919]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-[310px] rounded-xl bg-white dark:bg-[#191919]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.slice(0, 4).map(({ icon: Icon, label, value }, index) => (
              <div key={label} className={cn("min-w-0 rounded-xl p-4 md:p-5", tones[index])}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-current opacity-70">{label}</span>
                  <Icon size={17} className="shrink-0 text-current opacity-60" strokeWidth={1.6} />
                </div>
                <p className="mt-5 truncate font-jakarta text-2xl font-semibold tracking-tight md:text-3xl">
                  {value}
                </p>
                <p className="mt-2 text-[10px] text-current opacity-60">
                  {index === 1 ? "所选时间范围内注册" : "截至当前累计"}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
            <DashboardCard title="使用趋势" description={`近 ${rangeDays} 天 · 用户增长与对话活动`}>
              <UsageTrendChart data={data.trend} />
            </DashboardCard>
            <DashboardCard title="运营状态" description="账户验证与需要关注的事项">
              <div className="mb-4 rounded-lg bg-[#eeeafa] p-4 dark:bg-[#2c273b]">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-300">邮箱验证率</span>
                  <span className="font-jakarta text-2xl font-semibold">
                    {verifiedRate}
                    <span className="ml-1 text-sm">%</span>
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#9b8be8]"
                    style={{ width: `${verifiedRate}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-gray-500">
                  {formatCount(data.stats.verifiedUsers)} / {formatCount(data.stats.users)}{" "}
                  位用户已验证
                </p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {reminders.map(({ icon: Icon, label, tone, value }) => (
                  <div key={label} className="flex min-h-12 items-center gap-2">
                    <Icon size={15} className="text-gray-400" />
                    <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">{label}</span>
                    <span className={cn("font-jakarta text-sm font-semibold", tone)}>{value}</span>
                  </div>
                ))}
              </div>
            </DashboardCard>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <DashboardCard title="模型服务商" description="累计对话数 · Top 6">
              <OverviewDistributionChart data={providers} kind="provider" />
            </DashboardCard>
            <DashboardCard title="存储构成" description="按文件容量分布 · 不含头像">
              <div className="flex items-baseline justify-between">
                <span className="font-jakarta text-xl font-semibold">
                  {formatBytes(data.stats.fileBytes)}
                </span>
                <span className="text-xs text-gray-400">
                  {formatCount(data.stats.files)} 个文件
                </span>
              </div>
              <OverviewDistributionChart data={fileTypes} kind="storage" />
            </DashboardCard>
            <DashboardCard title="对话节奏" description="过去 90 天 · 每日新建对话">
              <div className="mb-5 rounded-lg bg-[#e8f3ed] p-4 dark:bg-[#22342d]">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  近 {rangeDays} 天消息数 / 新建对话数
                </p>
                <p className="mt-2 font-jakarta text-3xl font-semibold">
                  {averageDepth}
                  <span className="ml-2 text-xs font-normal text-gray-500">条 / 个</span>
                </p>
                <p className="mt-2 text-[10px] text-gray-500">包含期间在历史对话中发送的消息</p>
              </div>
              <ActivityHeatmap trend={data.activityTrend} />
            </DashboardCard>
          </div>
        </>
      )}
    </div>
  );
}
