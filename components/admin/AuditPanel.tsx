"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminError, AdminLoading, formatDateTime } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

type AuditLog = {
  action: string;
  actorEmail?: string;
  actorUserId?: string;
  createdAt: string;
  id: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  targetId?: string;
  targetType: string;
};

export function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/audit-logs?limit=100", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "审计日志加载失败");
      setLogs(data.logs || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "审计日志加载失败");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <div>
      <div className="mb-5">
        <h3 className="font-semibold">最近管理员操作</h3>
        <p className="mt-1 text-xs text-gray-400">审计日志仅供查看，不能在管理界面修改或删除</p>
      </div>
      {loading ? (
        <AdminLoading rows={8} />
      ) : error ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="text-xs text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">时间</th>
                  <th className="px-5 py-3 font-medium">管理员</th>
                  <th className="px-5 py-3 font-medium">操作</th>
                  <th className="px-5 py-3 font-medium">目标</th>
                  <th className="px-5 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr
                    className={cn(
                      "transition-colors hover:bg-gray-100/80 dark:hover:bg-white/[0.06]",
                      index % 2 === 0 && "bg-gray-50/55 dark:bg-white/[0.018]",
                    )}
                    key={log.id}
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-5 py-3">{log.actorEmail || log.actorUserId || "系统"}</td>
                    <td className="px-5 py-3 font-mono text-xs">{log.action}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {log.targetType}
                      {log.targetId ? ` · ${log.targetId.slice(0, 12)}` : ""}
                    </td>
                    <td className="px-5 py-3 text-gray-400">{log.ipAddress || "—"}</td>
                  </tr>
                ))}
                {!loading && !logs.length && (
                  <tr>
                    <td className="px-5 py-12 text-center text-gray-400" colSpan={5}>
                      暂无审计记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {logs.map((log) => (
              <article
                className="rounded-xl bg-gray-50/80 p-3.5 dark:bg-white/[0.035]"
                key={log.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {log.actorEmail || log.actorUserId || "系统"}
                    </p>
                    <p className="mt-1 font-mono text-xs text-primary">{log.action}</p>
                  </div>
                  <time className="shrink-0 text-[11px] text-gray-400">
                    {formatDateTime(log.createdAt)}
                  </time>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-200/70 pt-2 text-xs text-gray-400 dark:border-white/[0.07]">
                  <span className="min-w-0 truncate">
                    {log.targetType}
                    {log.targetId ? ` · ${log.targetId.slice(0, 12)}` : ""}
                  </span>
                  <span className="shrink-0">{log.ipAddress || "未知 IP"}</span>
                </div>
              </article>
            ))}
            {!logs.length && (
              <p className="py-12 text-center text-sm text-gray-400">暂无审计记录</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
