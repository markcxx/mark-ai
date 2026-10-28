"use client";
import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, MessageSquare, CircleAlert } from "lucide-react";
import { TokenUsageBreakdown } from "@/components/ui/TokenUsageBreakdown";
import { UsageBarChart } from "./UsageBarChart";
import { AppInput } from "@/components/ui/AppInput";
import { AppSelect } from "@/components/ui/AppSelect";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useSettingsResource } from "@/hooks/useSettingsResource";
import { monthBounds, utcMonth, type MonthlyUsage } from "@/lib/settings/statistics";
import {
  SettingsEmpty,
  SettingsError,
  SettingsSkeleton,
  SettingsGroup,
  SettingsDivider,
} from "./SettingsPrimitives";
import { StatisticCard, formatStat } from "./StatisticsVisuals";
import { UsageBreakdown } from "./UsageBreakdown";
import { ProviderBrandIcon } from "../ModelBrandIcon";

export function MonthlyUsagePanel() {
  const [month, setMonth] = useState(utcMonth());
  const [group, setGroup] = useState<"model" | "provider">("model");
  const [metric, setMetric] = useState<"tokens" | "spend">("tokens");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 5 });
  const [sort, setSort] = useState<"time" | "tokens">("time");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const { data, loading, error, retry } = useSettingsResource<MonthlyUsage>(
    `/api/settings/statistics?view=monthly&month=${month}&page=${pagination.page}&pageSize=${pagination.pageSize}&sort=${sort}&direction=${direction}`,
  );
  const chart = useMemo(() => {
    const rows = data?.daily || [];
    const totals = new Map<string, { label: string; tokens: number }>();
    const keyOf = (r: MonthlyUsage["daily"][number]) =>
      group === "provider" ? r.provider : `${r.provider}/${r.model}`;
    for (const r of rows) {
      const key = keyOf(r),
        prior = totals.get(key);
      totals.set(key, {
        label: group === "provider" ? r.provider : r.model,
        tokens: (prior?.tokens || 0) + r.tokens,
      });
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1].tokens - a[1].tokens);
    const categories = sorted.slice(0, 7).map(([key, item]) => ({
      key,
      label:
        sorted.filter(([, candidate]) => candidate.label === item.label).length > 1
          ? `${item.label} · ${key.slice(0, key.indexOf("/"))}`
          : item.label,
    }));
    if (sorted.length > 7) categories.push({ key: "__other", label: "其他" });
    const known = new Set(categories.map((c) => c.key));
    const { start, end } = monthBounds(month);
    const days = Array.from({ length: Math.round((+end - +start) / 86400000) }, (_, i) => ({
      date: `${month}-${String(i + 1).padStart(2, "0")}`,
      values: Array(categories.length).fill(0) as number[],
    }));
    for (const r of rows) {
      const index = categories.findIndex(
        (c) => c.key === (known.has(keyOf(r)) ? keyOf(r) : "__other"),
      );
      const d = days[Number(r.date.slice(8, 10)) - 1];
      if (d && index >= 0) d.values[index] += r.tokens;
    }
    return {
      categories,
      days,
    };
  }, [data, month, group]);
  const sortBy = (next: "time" | "tokens") => {
    setSort(next);
    setDirection(sort === next && direction === "desc" ? "asc" : "desc");
    setPagination((p) => ({ ...p, page: 1 }));
  };
  return (
    <SettingsGroup
      title="使用量"
      bodyClassName="py-5"
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <AppInput
            aria-label="选择统计月份"
            type="month"
            value={month}
            min="2000-01"
            max={utcMonth()}
            className="w-[150px] text-sm"
            onChange={(e) => {
              if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                setMonth(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }
            }}
          />
          <SegmentedControl
            value={group}
            onChange={setGroup}
            options={[
              { value: "model", label: "模型" },
              { value: "provider", label: "服务商" },
            ]}
          />
        </div>
      }
    >
      {error ? (
        <SettingsError message={error} onRetry={retry} />
      ) : loading || !data ? (
        <SettingsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatisticCard title="今日花费" value="—" description="尚未启用计费" />
            <StatisticCard
              title="本月花费"
              value="—"
              description={`${formatStat(data.total)} 次已保存回复 · 尚未计费`}
            />
            <UsageBreakdown data={data} group={group} />
          </div>
          <SettingsDivider />
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <SegmentedControl
              value={metric}
              onChange={setMetric}
              options={[
                { value: "spend", label: "金额" },
                { value: "tokens", label: "Token" },
              ]}
            />
          </div>
          {metric === "spend" ? (
            <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-white/10">
              <SettingsEmpty
                title="费用统计尚未开放"
                description="现有记录不包含实际扣费与历史价格，接入计费后展示费用趋势。"
              />
            </div>
          ) : (
            <UsageBarChart
              key={`${month}/${group}`}
              categories={chart.categories}
              days={chart.days}
            />
          )}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-white/[0.025]">
                <tr>
                  <th className="px-4 py-3 font-normal">
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => sortBy("time")}
                    >
                      时间
                      <ArrowDownUp size={12} />
                    </button>
                  </th>
                  <th className="px-3 font-normal">类型</th>
                  <th className="px-3 font-normal">模型</th>
                  <th className="px-3 font-normal">
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => sortBy("tokens")}
                    >
                      Token 使用量
                      <ArrowDownUp size={12} />
                    </button>
                  </th>
                  <th className="px-3 text-right font-normal">花费</th>
                  <th className="px-3 text-right font-normal">tok/s</th>
                  <th className="px-4 text-right font-normal">TTFT</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                      {`${Number(row.createdAt.slice(5, 7))}月 ${Number(row.createdAt.slice(8, 10))} ${row.createdAt.slice(11, 19)}`}
                    </td>
                    <td className="px-3">
                      <span
                        aria-label={row.interrupted ? "已中断的对话" : "对话"}
                        data-markai-tooltip={row.interrupted ? "已中断的对话" : "对话"}
                        className="inline-flex text-blue-500"
                      >
                        {row.interrupted ? <CircleAlert size={16} /> : <MessageSquare size={16} />}
                      </span>
                    </td>
                    <td className="w-[200px] max-w-[200px] px-3">
                      <div className="flex items-center gap-2">
                        <ProviderBrandIcon provider={row.provider} name={row.provider} size={18} />
                        <span
                          className="truncate"
                          data-markai-tooltip={`${row.model} · ${row.provider}`}
                        >
                          {row.model}
                        </span>
                      </div>
                    </td>
                    <td className="px-3">
                      <TokenUsageBreakdown
                        total={row.totalTokens}
                        input={row.inputTokens}
                        output={row.outputTokens}
                        estimated={row.source === "estimated"}
                      />
                    </td>
                    <td
                      className="px-3 text-right text-gray-400"
                      data-markai-tooltip="费用尚未开放"
                    >
                      —
                    </td>
                    <td
                      className="px-3 text-right text-gray-400"
                      data-markai-tooltip="该记录没有保存模型输出速度"
                    >
                      —
                    </td>
                    <td
                      className="px-4 text-right text-gray-400"
                      data-markai-tooltip="该记录没有保存首字耗时"
                    >
                      —
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.records.length && (
              <SettingsEmpty title="暂无用量记录" description="选择其他月份，或开始新的对话。" />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
            <span>
              第 {data.total ? (data.page - 1) * data.pageSize + 1 : 0}–
              {Math.min(data.page * data.pageSize, data.total)} 条，共 {formatStat(data.total)} 条 ·
              UTC
            </span>
            <div className="flex items-center gap-2">
              <AppSelect
                aria-label="每页条数"
                size="small"
                value={pagination.pageSize}
                options={[5, 10, 20, 50].map((n) => ({ value: n, label: `${n} 条/页` }))}
                onChange={(pageSize) => setPagination({ page: 1, pageSize })}
              />
              <IconButton
                size="sm"
                aria-label="上一页"
                data-markai-tooltip="上一页"
                disabled={data.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: data.page - 1 }))}
              >
                <ChevronLeft size={16} />
              </IconButton>
              <span className="flex size-7 items-center justify-center rounded-md bg-black/[0.03] text-gray-700 dark:bg-white/5 dark:text-gray-300">
                {data.page}
              </span>
              <IconButton
                size="sm"
                aria-label="下一页"
                data-markai-tooltip="下一页"
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => setPagination((p) => ({ ...p, page: data.page + 1 }))}
              >
                <ChevronRight size={16} />
              </IconButton>
            </div>
          </div>
        </>
      )}
    </SettingsGroup>
  );
}
