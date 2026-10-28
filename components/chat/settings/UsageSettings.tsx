"use client";
import { useSettingsResource } from "@/hooks/useSettingsResource";
import type { StatisticsOverview } from "@/lib/settings/statistics";
import { StatisticsOverviewPanel } from "./StatisticsVisuals";
import { MonthlyUsagePanel } from "./MonthlyUsagePanel";
import { SettingsError, SettingsSkeleton } from "./SettingsPrimitives";

function Overview() {
  const { data, loading, error, retry } = useSettingsResource<StatisticsOverview>(
    "/api/settings/statistics",
  );
  return error ? (
    <SettingsError message={error} onRetry={retry} />
  ) : loading || !data ? (
    <SettingsSkeleton />
  ) : (
    <StatisticsOverviewPanel data={data} />
  );
}
export function UsageSettings({ detail = false }: { detail?: boolean }) {
  return (
    <>
      {!detail && <Overview />}
      <MonthlyUsagePanel />
      <p className="mt-6 text-xs leading-6 text-gray-400">
        统计来自网页与 App 共用后端保存的会话，包含估算
        Token，已删除消息和被替换的回答不计入。任务耗时取单次回复的生成时长。历史消息没有费用快照，因此费用保持未开放，不作为收费依据。
      </p>
    </>
  );
}
