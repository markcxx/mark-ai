"use client";
import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { IconButton } from "@/components/ui/IconButton";
import { ProviderBrandIcon } from "../ModelBrandIcon";
import type { MonthlyUsage } from "@/lib/settings/statistics";
import { formatStat, StatisticCard } from "./StatisticsVisuals";
import { SettingsEmpty } from "./SettingsPrimitives";

export function UsageBreakdown({
  data,
  group,
}: {
  data: MonthlyUsage;
  group: "model" | "provider";
}) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        provider: string;
        calls: number;
        tokens: number;
        children: Map<string, { name: string; calls: number; tokens: number }>;
      }
    >();
    for (const row of data.daily) {
      const key = group === "model" ? `${row.provider}/${row.model}` : row.provider;
      const current = map.get(key) || {
        key,
        name: group === "model" ? row.model : row.provider,
        provider: row.provider,
        calls: 0,
        tokens: 0,
        children: new Map(),
      };
      current.calls += row.calls;
      current.tokens += row.tokens;
      const childKey = group === "model" ? row.provider : row.model;
      const child = current.children.get(childKey) || { name: childKey, calls: 0, tokens: 0 };
      child.calls += row.calls;
      child.tokens += row.tokens;
      current.children.set(childKey, child);
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.tokens - a.tokens);
  }, [data, group]);
  const title = group === "model" ? "活跃模型" : "活跃服务商";
  return (
    <>
      <StatisticCard
        title={title}
        value={formatStat(groups.length)}
        extra={
          <IconButton
            size="sm"
            aria-label={`查看${title}明细`}
            data-markai-tooltip="查看明细"
            onClick={() => setOpen(true)}
          >
            <Maximize2 size={14} />
          </IconButton>
        }
        description={
          <div className="flex min-h-5 flex-wrap items-center gap-1">
            {groups.slice(0, 12).map((row) => (
              <span key={row.key} data-markai-tooltip={row.name}>
                <ProviderBrandIcon provider={row.provider} name={row.name} size={18} />
              </span>
            ))}
            {groups.length > 12 && (
              <span className="text-xs text-gray-400">+{groups.length - 12}</span>
            )}
            {!groups.length && <span className="text-xs text-gray-400">暂无记录</span>}
          </div>
        }
      />
      <AppDialog open={open} onClose={() => setOpen(false)} title={`${title}明细`} width={640}>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5">
          {groups.map((row) => (
            <details
              key={row.key}
              open
              className="rounded-lg border border-gray-200 dark:border-white/10"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm">
                <span className="ml-1 break-all font-medium">{row.name}</span>
                <span className="ml-2 text-xs text-gray-400">{formatStat(row.tokens)} Tokens</span>
              </summary>
              <div className="border-t border-gray-200 px-4 dark:border-white/10">
                <table className="w-full table-fixed text-left text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="w-1/2 py-3 font-normal">
                        {group === "model" ? "服务商" : "模型"}
                      </th>
                      <th className="text-right font-normal">回复数</th>
                      <th className="text-right font-normal">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...row.children.values()].map((child) => (
                      <tr key={child.name}>
                        <td className="break-all py-2 pr-2">{child.name}</td>
                        <td className="text-right tabular-nums">{formatStat(child.calls)}</td>
                        <td className="text-right tabular-nums">{formatStat(child.tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
          {!groups.length && (
            <SettingsEmpty title="暂无记录" description="这个月份没有已保存的模型回复。" />
          )}
        </div>
      </AppDialog>
    </>
  );
}
