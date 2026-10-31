"use client";

import type { EChartsOption } from "echarts";
import { Plus, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { AdminChart } from "@/components/admin/AdminChart";
import { AppSelect } from "@/components/ui/AppSelect";
import { CAPABILITY_AXES } from "@/lib/model-ratings";
import {
  baseModelName,
  formatRankingValue,
  getRankingVendor,
  shortModelName,
  type RankingModel,
} from "@/lib/model-rankings";
import { chartTheme, escapeHtml, SERIES_COLORS } from "./chart-theme";
import { VendorLogo } from "./VendorLogo";

// Raw AA index scores on a shared 0–70 scale; no per-axis normalization.
const AXES: { key: string; label: string; value: (model: RankingModel) => number | undefined }[] = [
  { key: "intelligence", label: "综合智能", value: (model) => model.intelligence },
  { key: "coding", label: "编码", value: (model) => model.coding },
  { key: "agentic", label: "Agentic", value: (model) => model.agentic },
  ...CAPABILITY_AXES.map((axis) => ({
    key: axis.key,
    label: axis.label,
    value: (model: RankingModel) => model.capabilities?.[axis.key],
  })),
];
const MAX_SELECTED = 4;

/** Radar comparison of up to four models across every AA index. */
export function ModelRadarCompare({ models }: { models: RankingModel[] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  // Candidates: best-intelligence variant per family with every axis measured.
  const candidates = useMemo(() => {
    const families = new Map<string, RankingModel>();
    for (const model of models) {
      if (AXES.some((axis) => typeof axis.value(model) !== "number")) continue;
      const key = baseModelName(model.name).toLowerCase();
      const current = families.get(key);
      if (!current || (model.intelligence ?? -1) > (current.intelligence ?? -1))
        families.set(key, model);
    }
    return [...families.values()].sort((a, b) => (b.intelligence ?? 0) - (a.intelligence ?? 0));
  }, [models]);
  const [selected, setSelected] = useState<string[]>(() => {
    // Default: the leading model of the top three distinct vendors.
    const picked: RankingModel[] = [];
    for (const model of candidates) {
      if (picked.some((item) => getRankingVendor(item).key === getRankingVendor(model).key))
        continue;
      picked.push(model);
      if (picked.length === 3) break;
    }
    return picked.map((model) => model.id);
  });
  const chosen = selected.flatMap((id) => candidates.find((model) => model.id === id) ?? []);

  const option = useMemo<EChartsOption>(() => {
    const theme = chartTheme(dark);
    return {
      color: SERIES_COLORS,
      tooltip: {
        ...theme.tooltip,
        trigger: "item",
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const values = item.value as number[];
          return `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(String(item.name))}</div>${AXES.map(
            (axis, index) =>
              `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${theme.muted}">${axis.label}</span><span>${formatRankingValue(values[index], 1)}</span></div>`,
          ).join("")}`;
        },
      },
      radar: {
        radius: "68%",
        center: ["50%", "52%"],
        splitNumber: 4,
        indicator: AXES.map((axis) => ({ name: axis.label, max: 70, min: 0 })),
        axisName: { color: theme.text, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.border } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: theme.border } },
      },
      series: [
        {
          type: "radar",
          symbolSize: 4,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.08 },
          emphasis: { areaStyle: { opacity: 0.25 } },
          data: chosen.map((model) => ({
            name: model.name,
            value: AXES.map((axis) => axis.value(model) ?? 0),
          })),
        },
      ],
    };
  }, [chosen, dark]);

  const remaining = candidates
    .filter((model) => !selected.includes(model.id))
    .slice(0, 40)
    .map((model) => ({ value: model.id, label: shortModelName(model.name) }));

  if (!candidates.length)
    return <p className="py-10 text-center text-sm text-gray-500">暂无完整评测数据的模型</p>;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {chosen.map((model, index) => (
          <span
            key={model.id}
            className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-gray-200 pl-2 pr-1 text-xs dark:border-white/10"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: SERIES_COLORS[index] }}
            />
            <VendorLogo vendor={getRankingVendor(model)} size={14} />
            <span className="truncate font-jakarta">{shortModelName(model.name)}</span>
            <button
              type="button"
              aria-label={`移除 ${model.name}`}
              data-markai-tooltip="移除"
              disabled={chosen.length <= 1}
              onClick={() => setSelected((ids) => ids.filter((id) => id !== model.id))}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
            >
              <X size={13} />
            </button>
          </span>
        ))}
        {chosen.length < MAX_SELECTED && (
          <AppSelect<string>
            aria-label="添加对比模型"
            placeholder={
              <span className="flex items-center gap-1">
                <Plus size={13} />
                添加模型
              </span>
            }
            value={undefined}
            onChange={(id) => setSelected((ids) => [...ids, id].slice(0, MAX_SELECTED))}
            options={remaining}
            size="small"
            style={{ width: 132 }}
          />
        )}
      </div>
      <AdminChart option={option} height={360} mobileHeight={320} />
      <p className="text-[11px] text-gray-400">
        九项均为 AA 原始指数（统一 0–70 刻度），面积越大整体越强；最多对比 {MAX_SELECTED} 个模型。
      </p>
    </div>
  );
}
