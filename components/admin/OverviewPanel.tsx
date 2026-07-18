"use client";

import type { EChartsOption } from "echarts";
import { Segmented } from "@lobehub/ui";
import {
  BadgeCheck,
  ClipboardClock,
  Files,
  MessageCircleMore,
  MessageSquareText,
  ShieldBan,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminChart } from "@/components/admin/AdminChart";
import { AdminError, formatBytes } from "@/components/admin/AdminPrimitives";

type OverviewData = {
  fileTypes: Array<{ name: string; value: number }>;
  providerTypes: Array<{ name: string; value: number }>;
  rangeDays: number;
  roleTypes: Array<{ name: string; value: number }>;
  stats: {
    bannedUsers: number;
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
  trend: Array<{
    date: string;
    files: number;
    messages: number;
    sessions: number;
    users: number;
  }>;
  waitlistStatuses: Array<{ name: string; value: number }>;
};

const waitlistLabels: Record<string, string> = {
  approved: "已批准",
  invited: "已邀请",
  pending: "待审批",
  registered: "已注册",
  rejected: "已拒绝",
};

const fileTypeLabels: Record<string, string> = {
  application: "文档与应用",
  audio: "音频",
  image: "图片",
  text: "文本",
  video: "视频",
};

export function OverviewPanel() {
  const [data, setData] = useState<OverviewData>();
  const [error, setError] = useState("");
  const [rangeDays, setRangeDays] = useState(14);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/admin/overview?days=${rangeDays}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "概览数据加载失败");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "概览数据加载失败");
    }
  }, [rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const userTrendOption = useMemo<EChartsOption>(
    () => ({
      dataZoom: [{ end: 100, start: rangeDays === 30 ? 20 : 0, type: "inside" }],
      grid: { bottom: 26, left: 42, right: 18, top: 20 },
      series: [
        {
          areaStyle: { opacity: 0.16 },
          data: data?.trend.map((item) => item.users) || [],
          emphasis: { focus: "series" },
          name: "新增用户",
          showSymbol: rangeDays <= 14,
          smooth: true,
          type: "line",
        },
      ],
      tooltip: { axisPointer: { type: "line" }, trigger: "axis" },
      xAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        data: data?.trend.map((item) => item.date.slice(5)) || [],
        type: "category",
      },
      yAxis: [{ minInterval: 1, type: "value" }],
    }),
    [data, rangeDays],
  );

  const usageTrendOption = useMemo<EChartsOption>(
    () => ({
      dataZoom: [{ end: 100, start: rangeDays === 30 ? 20 : 0, type: "inside" }],
      grid: { bottom: 28, left: 42, right: 24, top: 45 },
      legend: { left: 0, selectedMode: true, top: 0 },
      series: [
        {
          data: data?.trend.map((item) => item.sessions) || [],
          emphasis: { focus: "series" },
          name: "新增对话",
          stack: "使用量",
          type: "bar",
        },
        {
          data: data?.trend.map((item) => item.messages) || [],
          emphasis: { focus: "series" },
          markLine: {
            data: [[{ type: "min" }, { type: "max" }]],
            lineStyle: { type: "dashed" },
            symbol: ["none", "none"],
          },
          name: "新增消息",
          stack: "使用量",
          type: "bar",
        },
        {
          data: data?.trend.map((item) => item.files) || [],
          emphasis: { focus: "series" },
          name: "新增文件",
          stack: "使用量",
          type: "bar",
        },
      ],
      toolbox: {
        feature: { restore: { title: "还原" }, saveAsImage: { title: "保存图片" } },
        right: 0,
        top: 0,
      },
      tooltip: { axisPointer: { type: "shadow" }, trigger: "axis" },
      xAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        data: data?.trend.map((item) => item.date.slice(5)) || [],
        type: "category",
      },
      yAxis: [{ minInterval: 1, type: "value" }],
    }),
    [data, rangeDays],
  );
  const waitlistOption = useMemo<EChartsOption>(
    () => ({
      legend: { bottom: 0, left: "center" },
      series: [
        {
          center: ["50%", "43%"],
          data: (data?.waitlistStatuses || []).map((item) => ({
            name: waitlistLabels[item.name] || item.name,
            value: item.value,
          })),
          emphasis: { label: { fontSize: 14, fontWeight: "bold", show: true }, scale: true },
          label: { formatter: "{b}\n{c}" },
          radius: ["46%", "70%"],
          selectedMode: "single",
          type: "pie",
        },
      ],
      tooltip: { trigger: "item" },
    }),
    [data],
  );
  const fileOption = useMemo<EChartsOption>(
    () => ({
      grid: { bottom: 18, left: 88, right: 18, top: 12 },
      series: [
        {
          colorBy: "data",
          data: (data?.fileTypes || []).map((item) => item.value),
          emphasis: { focus: "series" },
          type: "bar",
        },
      ],
      tooltip: { trigger: "axis", valueFormatter: (value) => formatBytes(Number(value)) },
      xAxis: {
        axisLabel: { formatter: (value: number) => formatBytes(value) },
        splitLine: { lineStyle: { opacity: 0.12 } },
        type: "value",
      },
      yAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        data: (data?.fileTypes || []).map((item) => fileTypeLabels[item.name] || item.name),
        type: "category",
      },
    }),
    [data],
  );

  const providerOption = useMemo<EChartsOption>(
    () => ({
      legend: { bottom: 0, left: "center", type: "scroll" },
      series: [
        {
          center: ["50%", "43%"],
          data: data?.providerTypes || [],
          emphasis: { label: { fontSize: 14, fontWeight: "bold", show: true } },
          label: { formatter: "{b}\n{d}%" },
          radius: [28, "70%"],
          roseType: "radius",
          type: "pie",
        },
      ],
      tooltip: { formatter: "{b}<br/>对话 {c} · {d}%", trigger: "item" },
    }),
    [data],
  );

  const roleOption = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          center: ["50%", "50%"],
          data: (data?.roleTypes || []).map((item) => ({
            name: item.name === "admin" ? "管理员" : "普通用户",
            value: item.value,
          })),
          emphasis: { label: { fontSize: 15, fontWeight: "bold", show: true } },
          label: { formatter: "{b}\n{c} 人" },
          radius: ["44%", "72%"],
          selectedMode: "single",
          type: "pie",
        },
      ],
      tooltip: { formatter: "{b}<br/>{c} 人 · {d}%", trigger: "item" },
    }),
    [data],
  );

  const heatmapOption = useMemo<EChartsOption>(() => {
    const calendarData = (data?.trend || []).map((item) => [item.date, item.sessions]);
    const firstDate = data?.trend[0]?.date;
    const lastDate = data?.trend.at(-1)?.date;
    return {
      calendar: {
        cellSize: ["auto", 18],
        dayLabel: { firstDay: 1, nameMap: "ZH" },
        itemStyle: { borderWidth: 0.5 },
        left: 36,
        monthLabel: { nameMap: "ZH" },
        range: firstDate && lastDate ? [firstDate, lastDate] : undefined,
        right: 24,
        top: 64,
        yearLabel: { show: false },
      },
      series: {
        coordinateSystem: "calendar",
        data: calendarData,
        type: "heatmap",
      },
      tooltip: {
        formatter: (params: unknown) => {
          const item = params as { data?: [string, number] };
          return `${item.data?.[0] || ""}<br/>${item.data?.[1] || 0} 个新对话`;
        },
      },
      visualMap: {
        left: "center",
        max: Math.max(1, ...calendarData.map((item) => Number(item[1]))),
        min: 0,
        orient: "horizontal",
        top: 8,
        type: "piecewise",
      },
    } satisfies EChartsOption;
  }, [data]);

  const items = [
    {
      icon: Users,
      label: "全部用户",
      tone: "bg-[#5B8DB8]/10 text-[#5B8DB8]",
      value: data?.stats.users ?? "—",
    },
    {
      icon: UserPlus,
      label: `近 ${rangeDays} 天新增`,
      tone: "bg-[#69A66F]/10 text-[#69A66F]",
      value: data?.stats.newUsers ?? "—",
    },
    {
      icon: BadgeCheck,
      label: "已验证用户",
      tone: "bg-[#4FAF9D]/10 text-[#4FAF9D]",
      value: data?.stats.verifiedUsers ?? "—",
    },
    {
      icon: ShieldBan,
      label: "已封禁用户",
      tone: "bg-[#D8737F]/10 text-[#D8737F]",
      value: data?.stats.bannedUsers ?? "—",
    },
    {
      icon: MessageSquareText,
      label: "全部对话",
      tone: "bg-[#6E78D6]/10 text-[#6E78D6]",
      value: data?.stats.sessions ?? "—",
    },
    {
      icon: MessageCircleMore,
      label: "全部消息",
      tone: "bg-[#4FAF9D]/10 text-[#4FAF9D]",
      value: data?.stats.messages ?? "—",
    },
    {
      icon: Files,
      label: "存储文件",
      tone: "bg-[#B980A4]/10 text-[#B980A4]",
      value: data ? `${data.stats.files} · ${formatBytes(data.stats.fileBytes)}` : "—",
    },
    {
      icon: ClipboardClock,
      label: "待审批申请",
      tone: "bg-[#D9A441]/10 text-[#D9A441]",
      value: data?.stats.pendingWaitlist ?? "—",
    },
  ];

  if (error) return <AdminError message={error} onRetry={() => void load()} />;

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="h-[66px] rounded-lg bg-gray-50 dark:bg-white/[0.035]" key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <div className="h-[340px] rounded-lg bg-gray-50 dark:bg-white/[0.035]" />
          <div className="h-[340px] rounded-lg bg-gray-50 dark:bg-white/[0.035]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">运营数据</h3>
          <p className="mt-1 text-xs text-gray-400">点击图例可隐藏维度，滚轮可缩放趋势图</p>
        </div>
        <Segmented
          onChange={(value) => setRangeDays(Number(value))}
          options={[
            { label: "7 天", value: 7 },
            { label: "14 天", value: 14 },
            { label: "30 天", value: 30 },
          ]}
          padding={4}
          value={rangeDays}
          variant="borderless"
        />
      </div>
      <div className="grid grid-cols-2 gap-x-7 gap-y-5 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div className="flex items-center gap-3 py-2" key={item.label}>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.tone}`}
              >
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="mt-0.5 truncate text-lg font-semibold">{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid gap-10 xl:grid-cols-[0.85fr_1.35fr]">
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">用户增长趋势</h3>
          <AdminChart height={330} option={userTrendOption} />
        </section>
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">对话、消息与文件使用量</h3>
          <AdminChart height={330} option={usageTrendOption} />
        </section>
      </div>
      <div className="grid gap-10 xl:grid-cols-3">
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">模型服务商使用分布</h3>
          <AdminChart height={300} option={providerOption} />
        </section>
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">用户角色构成</h3>
          <AdminChart height={300} option={roleOption} />
        </section>
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">等候名单状态</h3>
          <AdminChart height={300} option={waitlistOption} />
        </section>
      </div>
      <div className="grid gap-10 xl:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">每日对话活跃日历</h3>
          <AdminChart height={220} option={heatmapOption} />
        </section>
        <section className="min-w-0">
          <h3 className="text-sm font-semibold">文件存储分布</h3>
          <AdminChart height={300} option={fileOption} />
        </section>
      </div>
    </div>
  );
}
