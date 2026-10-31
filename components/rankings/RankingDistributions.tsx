"use client";

import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { AdminChart } from "@/components/admin/AdminChart";
import {
  formatRankingValue,
  shortModelName,
  type RankedRow,
  type RankingModel,
} from "@/lib/model-rankings";
import { chartTheme, escapeHtml, SERIES_COLORS, vendorColor } from "./chart-theme";

/** Vendor share among the top N of the intelligence ranking. */
export function VendorShareDonut({ rows, top = 50 }: { rows: RankedRow[]; top?: number }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const option = useMemo<EChartsOption>(() => {
    const theme = chartTheme(dark);
    const counts = new Map<string, { row: RankedRow; count: number }>();
    for (const row of rows.slice(0, top)) {
      const entry = counts.get(row.vendor.key);
      if (entry) entry.count += 1;
      else counts.set(row.vendor.key, { row, count: 1 });
    }
    const data = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .map(({ row, count }) => ({
        name: row.vendor.label,
        value: count,
        itemStyle: { color: vendorColor(row.vendor, dark) },
      }));
    const total = Math.min(rows.length, top);
    return {
      tooltip: {
        ...theme.tooltip,
        trigger: "item",
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          return `${escapeHtml(item.name)}：${item.value} 个（${Math.round(Number(item.percent))}%）`;
        },
      },
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 0,
        top: "middle",
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 8,
        textStyle: { color: theme.muted, fontSize: 11 },
      },
      title: {
        text: String(total),
        subtext: `前 ${total} 名`,
        left: "34%",
        top: "40%",
        textAlign: "center",
        textStyle: { color: theme.text, fontSize: 22, fontWeight: 600 },
        subtextStyle: { color: theme.muted, fontSize: 11 },
        itemGap: 2,
      },
      series: [
        {
          type: "pie",
          radius: ["52%", "76%"],
          center: ["35%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 4 },
          data,
        },
      ],
    };
  }, [dark, rows, top]);
  return <AdminChart option={option} height={280} mobileHeight={260} />;
}

/** How many evaluated models fall into each 5-point intelligence band. */
export function IntelligenceHistogram({ models }: { models: RankingModel[] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const option = useMemo<EChartsOption>(() => {
    const theme = chartTheme(dark);
    const values = models.flatMap((model) =>
      typeof model.intelligence === "number" && Number.isFinite(model.intelligence)
        ? [model.intelligence]
        : [],
    );
    const top = Math.ceil(Math.max(...values, 5) / 5) * 5;
    const bins = Array.from({ length: top / 5 }, (_, index) => ({
      label: `${index * 5}–${index * 5 + 5}`,
      count: 0,
    }));
    for (const value of values) bins[Math.min(bins.length - 1, Math.floor(value / 5))].count += 1;
    return {
      grid: { top: 16, left: 4, right: 8, bottom: 4, containLabel: true },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          return `综合智能 ${item.name} 分：${item.value} 个模型`;
        },
      },
      xAxis: {
        type: "category",
        data: bins.map((bin) => bin.label),
        axisLine: theme.axisLine,
        axisTick: { show: false },
        axisLabel: { ...theme.axisLabel, interval: 1 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: theme.axisLabel,
        splitLine: theme.splitLine,
      },
      series: [
        {
          type: "bar",
          barCategoryGap: "12%",
          data: bins.map((bin, index) => ({
            value: bin.count,
            // Higher bands get a deeper blue so the right tail stands out.
            itemStyle: {
              color: `color-mix(in srgb, #2563eb ${Math.round(30 + (index / bins.length) * 70)}%, ${dark ? "#111214" : "#ffffff"})`,
              borderRadius: [4, 4, 0, 0],
            },
          })),
        },
      ],
    };
  }, [dark, models]);
  return <AdminChart option={option} height={280} mobileHeight={240} />;
}

const INDEX_SERIES = [
  { key: "intelligence", name: "综合智能", value: (model: RankingModel) => model.intelligence },
  { key: "coding", name: "编码", value: (model: RankingModel) => model.coding },
  { key: "agentic", name: "Agentic", value: (model: RankingModel) => model.agentic },
] as const;

/** Intelligence, coding and agentic side by side for the leading models. */
export function IndexGroupedBars({ rows }: { rows: RankedRow[] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const option = useMemo<EChartsOption>(() => {
    const theme = chartTheme(dark);
    const top = rows
      .filter((row) => INDEX_SERIES.every((series) => typeof series.value(row.model) === "number"))
      .slice(0, 10);
    return {
      color: SERIES_COLORS,
      grid: { top: 36, left: 4, right: 8, bottom: 4, containLabel: true },
      legend: {
        top: 0,
        left: 0,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 6,
        textStyle: { color: theme.muted, fontSize: 11 },
      },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value) => formatRankingValue(Number(value), 1),
      },
      xAxis: {
        type: "category",
        data: top.map((row) => shortModelName(row.model.name)),
        axisLine: theme.axisLine,
        axisTick: { show: false },
        axisLabel: {
          ...theme.axisLabel,
          interval: 0,
          rotate: 30,
          width: 110,
          overflow: "truncate",
        },
      },
      yAxis: { type: "value", axisLabel: theme.axisLabel, splitLine: theme.splitLine },
      series: INDEX_SERIES.map((series) => ({
        type: "bar" as const,
        name: series.name,
        barGap: "8%",
        barCategoryGap: "28%",
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        data: top.map((row) => series.value(row.model) ?? 0),
      })),
    };
  }, [dark, rows]);
  return <AdminChart option={option} height={340} mobileHeight={320} />;
}
