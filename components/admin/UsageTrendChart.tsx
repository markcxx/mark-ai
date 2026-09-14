"use client";

import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { AdminChart } from "./AdminChart";

export type UsageTrendPoint = {
  date: string;
  users: number;
  sessions: number;
  messages: number;
};

const series = [
  { key: "users", name: "新增用户", color: "#10b981", axis: 0 },
  { key: "sessions", name: "对话", color: "#3b82f6", axis: 0 },
  { key: "messages", name: "消息", color: "#8b5cf6", axis: 1 },
] as const;

export function UsageTrendChart({ data }: { data: UsageTrendPoint[] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const option = useMemo<EChartsOption>(() => {
    const muted = dark ? "#9ca3af" : "#6b7280";
    const border = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
    return {
      color: series.map((item) => item.color),
      grid: { top: 34, left: 8, right: 8, bottom: 48, containLabel: true },
      legend: {
        bottom: 0,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 5,
        itemGap: 24,
        textStyle: { color: muted, fontSize: 12 },
      },
      tooltip: {
        trigger: "axis",
        confine: true,
        padding: [10, 14],
        backgroundColor: dark ? "#191919" : "#ffffff",
        borderColor: border,
        borderWidth: 1,
        textStyle: { color: dark ? "#f3f4f6" : "#111827", fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: muted, type: "dashed" } },
        valueFormatter: (value) => Number(value).toLocaleString("zh-CN"),
      },
      xAxis: {
        type: "category",
        data: data.map((item) => item.date),
        boundaryGap: false,
        axisLine: { lineStyle: { color: border } },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          fontSize: 11,
          hideOverlap: true,
          margin: 12,
          formatter: (date: string) => date.slice(5).replace("-", "/"),
        },
      },
      yAxis: [0, 1].map((index) => ({
        type: "value" as const,
        name: index ? "消息数" : "用户 / 对话数",
        min: 0,
        minInterval: 1,
        splitNumber: 4,
        nameGap: 18,
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: index === 0, lineStyle: { color: border, type: "dashed" as const } },
      })),
      series: series.map((item) => ({
        name: item.name,
        type: "line",
        yAxisIndex: item.axis,
        data: data.map((point) => point[item.key]),
        smooth: false,
        showSymbol: data.length <= 7,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 2.3 },
        itemStyle: { color: item.color },
        emphasis: { focus: "series", scale: true },
      })),
    };
  }, [data, dark]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        {series.map((item) => (
          <div key={item.key} className="flex items-baseline gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">{item.name}</span>
            <span className="font-jakarta text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {data.reduce((sum, point) => sum + point[item.key], 0).toLocaleString("zh-CN")}
            </span>
          </div>
        ))}
      </div>
      <AdminChart height={280} mobileHeight={270} option={option} />
      <p className="mt-2 text-[11px] text-gray-400">
        点击图例可隐藏或显示曲线；消息数使用右侧坐标。
      </p>
    </div>
  );
}
