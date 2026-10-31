"use client";

import type { EChartsOption } from "echarts";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { AdminChart } from "@/components/admin/AdminChart";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  blendedPrice,
  formatRankingValue,
  getRankingVendor,
  median,
  paretoFrontier,
  shortModelName,
  type RankingModel,
} from "@/lib/model-rankings";
import { chartTheme, escapeHtml, vendorColor } from "./chart-theme";

type Axis = "price" | "speed" | "latency";

const AXES: Record<
  Axis,
  {
    label: string;
    tab: string;
    unit: string;
    lowerIsBetter: boolean;
    value: (model: RankingModel) => number | undefined;
    hint: string;
  }
> = {
  price: {
    label: "综合价格",
    tab: "× 价格",
    unit: "美元 / 百万 tokens",
    lowerIsBetter: true,
    value: (model) => {
      const price = blendedPrice(model);
      return price && price > 0 ? price : undefined;
    },
    hint: "越靠左上越划算",
  },
  speed: {
    label: "输出速度",
    tab: "× 速度",
    unit: "tokens/s",
    lowerIsBetter: false,
    value: (model) => model.outputTokensPerSecond || undefined,
    hint: "越靠右上越快且越聪明",
  },
  latency: {
    label: "首字延迟",
    tab: "× 延迟",
    unit: "秒",
    lowerIsBetter: true,
    value: (model) => model.timeToFirstTokenSeconds || undefined,
    hint: "越靠左上响应越快",
  },
};

/**
 * Intelligence against price, speed or latency. The connected line is the
 * Pareto frontier: no other model is both smarter and better on the x axis.
 */
export function RankingScatterChart({
  models,
  defaultAxis = "price",
  height = 360,
}: {
  models: RankingModel[];
  defaultAxis?: Axis;
  height?: number;
}) {
  const [axis, setAxis] = useState<Axis>(defaultAxis);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const { option, count, frontierCount } = useMemo(() => {
    const config = AXES[axis];
    const theme = chartTheme(dark);
    const points = models.flatMap((model) => {
      const x = config.value(model);
      const y = model.intelligence;
      if (x === undefined || y === undefined || !Number.isFinite(x)) return [];
      return [{ model, vendor: getRankingVendor(model), x, y }];
    });
    const frontier = paretoFrontier(points, config.lowerIsBetter);
    const onFrontier = new Set(frontier.map((point) => point.model.id));
    const medianX = median(points.map((point) => point.x));
    const medianY = median(points.map((point) => point.y));
    const option: EChartsOption = {
      grid: { top: 24, left: 8, right: 24, bottom: 34, containLabel: true },
      tooltip: {
        ...theme.tooltip,
        trigger: "item",
        formatter: (params) => {
          const item = (Array.isArray(params) ? params[0] : params).data as {
            fullName?: string;
            vendor?: string;
            value: [number, number];
            frontier?: boolean;
          };
          if (!item?.fullName) return "";
          return `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(item.fullName)}</div>
            <div style="color:${theme.muted}">${escapeHtml(item.vendor || "")}${item.frontier ? " · 效率前沿" : ""}</div>
            <div>综合智能 ${formatRankingValue(item.value[1], 1)}</div>
            <div>${config.label} ${formatRankingValue(item.value[0])} ${config.unit}</div>`;
        },
      },
      xAxis: {
        type: "log",
        name: `${config.label}（${config.unit}，对数刻度）`,
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: theme.muted, fontSize: 11 },
        axisLine: theme.axisLine,
        axisTick: { show: false },
        axisLabel: theme.axisLabel,
        splitLine: theme.splitLine,
      },
      yAxis: {
        type: "value",
        name: "综合智能",
        nameTextStyle: { color: theme.muted, fontSize: 11, align: "left" },
        min: (value) => Math.max(0, Math.floor(value.min / 5) * 5),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: theme.axisLabel,
        splitLine: theme.splitLine,
      },
      series: [
        {
          type: "scatter",
          symbolSize: (_value, params) =>
            (params.data as { frontier?: boolean }).frontier ? 11 : 8,
          data: points.map(({ model, vendor, x, y }) => {
            const frontierPoint = onFrontier.has(model.id);
            return {
              name: shortModelName(model.name),
              fullName: model.name,
              vendor: vendor.label,
              frontier: frontierPoint,
              value: [x, y],
              itemStyle: {
                color: vendorColor(vendor, dark),
                opacity: frontierPoint ? 1 : vendor.key === "other" ? 0.35 : 0.6,
                borderColor: theme.surface,
                borderWidth: 1,
              },
              label: frontierPoint
                ? {
                    show: true,
                    formatter: "{b}",
                    position: "right" as const,
                    color: theme.text,
                    fontSize: 10,
                  }
                : undefined,
            };
          }),
          labelLayout: { hideOverlap: true },
          emphasis: { scale: 1.6 },
          z: 3,
          markLine:
            medianX !== undefined && medianY !== undefined
              ? {
                  silent: true,
                  symbol: "none",
                  label: { show: false },
                  lineStyle: { color: theme.muted, type: "dotted", opacity: 0.5 },
                  data: [{ xAxis: medianX }, { yAxis: medianY }],
                }
              : undefined,
        },
        {
          type: "line",
          silent: true,
          symbol: "none",
          step: config.lowerIsBetter ? "end" : "start",
          lineStyle: { color: dark ? "#e5e7eb" : "#111827", width: 1.5, opacity: 0.55 },
          data: [...frontier].sort((a, b) => a.x - b.x).map((point) => [point.x, point.y]),
          z: 2,
        },
      ],
    };
    return { option, count: points.length, frontierCount: frontier.length };
  }, [axis, dark, models]);

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<Axis>
          value={axis}
          onChange={setAxis}
          options={(Object.keys(AXES) as Axis[]).map((key) => ({
            value: key,
            label: `智能 ${AXES[key].tab}`,
          }))}
          className="min-h-9 md:min-h-8"
        />
        <span className="text-[11px] text-gray-400">
          {count} 个模型 · {AXES[axis].hint}
        </span>
      </div>
      <AdminChart option={option} height={height} mobileHeight={320} />
      <p className="mt-1 text-[11px] leading-5 text-gray-400">
        实线为效率前沿：线上的 {frontierCount} 个模型没有被任何模型同时在智能和{AXES[axis].label}
        上超越，并标注了名称；点线为中位数。
      </p>
    </div>
  );
}
