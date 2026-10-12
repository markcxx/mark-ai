"use client";

import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { AdminChart } from "./AdminChart";

export const overviewColors = [
  "#9b8be8",
  "#70b6a3",
  "#e8bd73",
  "#87afd7",
  "#d99ab9",
  "#a9b58a",
  "#b2a7c2",
  "#9099a5",
];

export function OverviewDistributionChart({
  data,
  kind,
}: {
  data: Array<{ name: string; value: number }>;
  kind: "provider" | "storage";
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const option = useMemo<EChartsOption>(() => {
    const color = dark ? "#b4b4bc" : "#777781";
    const tooltip = {
      trigger: "item" as const,
      confine: true,
      backgroundColor: dark ? "#191919" : "#fff",
      borderColor: dark ? "#383838" : "#e5e7eb",
      textStyle: { color },
      valueFormatter: (value: unknown) =>
        kind === "storage"
          ? `${(Number(value) / 1024 / 1024).toFixed(2)} MB`
          : `${Number(value).toLocaleString("zh-CN")} 个对话`,
    };
    return kind === "storage"
      ? {
          color: overviewColors,
          tooltip,
          legend: {
            bottom: 0,
            icon: "circle",
            itemWidth: 8,
            itemHeight: 8,
            textStyle: { color, fontSize: 11 },
          },
          series: [
            {
              type: "pie",
              radius: ["53%", "76%"],
              center: ["50%", "43%"],
              label: { show: false },
              padAngle: 3,
              itemStyle: { borderRadius: 5 },
              data,
              emphasis: { scaleSize: 5 },
            },
          ],
        }
      : {
          tooltip,
          grid: { left: 0, right: 35, top: 8, bottom: 0, containLabel: true },
          xAxis: { type: "value", show: false },
          yAxis: {
            type: "category",
            inverse: true,
            data: data.map((d) => d.name),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color, width: 90, overflow: "truncate", fontSize: 11 },
          },
          series: [
            {
              type: "bar",
              barMaxWidth: 16,
              showBackground: true,
              backgroundStyle: {
                color: dark ? "rgba(255,255,255,.04)" : "#f5f5f7",
                borderRadius: 5,
              },
              label: { show: true, position: "right", color, fontSize: 11 },
              data: data.map((d, i) => ({
                value: d.value,
                itemStyle: { color: overviewColors[i % overviewColors.length], borderRadius: 5 },
              })),
            },
          ],
        };
  }, [data, kind, dark]);
  if (!data.some((d) => d.value > 0))
    return (
      <div className="flex h-[230px] items-center justify-center text-xs text-gray-400">
        暂无统计数据
      </div>
    );
  return <AdminChart option={option} height={230} />;
}
