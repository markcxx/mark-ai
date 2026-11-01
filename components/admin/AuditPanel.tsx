"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  AdminEmpty,
  AdminError,
  AdminFilterTabs,
  AdminLoading,
  AdminPagination,
  AdminRefresh,
  AdminSurface,
  AdminToolbar,
  adminRow,
  adminTd,
  adminTh,
  formatDateTime,
} from "@/components/admin/AdminPrimitives";
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

const ACTION_LABELS: Record<string, string> = {
  "announcement.withdraw": "撤回公告",
  "announcement.publish": "发布公告",
  "conversation.batch_delete": "批量删除对话",
  "conversation.delete": "删除对话",
  "conversation.rename": "重命名对话",
  "conversation.view": "查看对话",
  "file.batch_delete": "批量删除文件",
  "file.delete": "删除文件",
  "membership.assign": "调整会员",
  "membership.plans.update": "更新套餐",
  "model.presentation.update": "更新模型展示",
  "user.batch_delete": "批量删除用户",
  "user.delete": "删除用户",
  "user.session.revoke": "注销登录会话",
  "user.update": "更新用户",
  "user.view": "查看用户",
  "waitlist.approve": "批准申请",
  "waitlist.batch_delete": "批量删除申请",
  "waitlist.delete": "删除申请",
  "waitlist.reject": "拒绝申请",
  "waitlist.resend": "重发邀请",
  "waitlist.revoke": "撤销邀请",
};

// Neutral by default; only destructive and access-changing actions get color.
const actionTone = (action: string) =>
  /delete|revoke|withdraw/.test(action)
    ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
    : /view/.test(action)
      ? "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
      : /approve|assign/.test(action)
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300";

const TARGET_LABELS: Record<string, string> = {
  announcement: "公告",
  auth_session: "登录会话",
  conversation: "对话",
  file: "文件",
  model: "模型",
  plans: "套餐",
  user: "用户",
  user_conversations: "用户对话",
  user_files: "用户文件",
  users: "用户",
  waitlist: "等候名单",
};

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "user", label: "用户" },
  { value: "waitlist", label: "等候名单" },
  { value: "conversation", label: "对话" },
  { value: "file", label: "文件" },
  { value: "plans", label: "套餐" },
  { value: "model", label: "模型" },
  { value: "announcement", label: "公告" },
];

const relative = (value: string) => {
  const diff = Date.now() - Date.parse(value);
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatDateTime(value).split(" ")[0];
};

export function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [target, setTarget] = useState("all");
  const [expanded, setExpanded] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
      if (target !== "all") params.set("targetType", target);
      const response = await fetch(`/api/admin/audit-logs?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "审计日志加载失败");
      setLogs(data.logs || []);
      setTotal(Number(data.total || 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "审计日志加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, target]);
  useEffect(() => void load(), [load]);

  const detail = (log: AuditLog) => {
    const entries = Object.entries(log.metadata || {});
    return (
      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="text-gray-400">操作代码</dt>
        <dd className="break-all font-mono">{log.action}</dd>
        <dt className="text-gray-400">目标 ID</dt>
        <dd className="break-all font-mono">{log.targetId || "—"}</dd>
        <dt className="text-gray-400">完整时间</dt>
        <dd>{formatDateTime(log.createdAt)}</dd>
        {entries.length > 0 && (
          <>
            <dt className="text-gray-400">附加信息</dt>
            <dd>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 font-mono text-[11px] leading-5 dark:bg-white/[0.04]">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </dd>
          </>
        )}
      </dl>
    );
  };

  return (
    <AdminSurface>
      <AdminToolbar actions={<AdminRefresh loading={loading} onClick={() => void load()} />}>
        <AdminFilterTabs
          label="操作对象"
          onChange={(value) => {
            setTarget(value);
            setPage(1);
          }}
          options={FILTERS}
          value={target}
        />
        <p className="hidden text-[11px] text-gray-400 xl:block">
          审计日志只读，不能在管理界面修改或删除
        </p>
      </AdminToolbar>
      {loading ? (
        <AdminLoading rows={8} />
      ) : error ? (
        <AdminError message={error} onRetry={() => void load()} />
      ) : !logs.length ? (
        <AdminEmpty
          description={target !== "all" ? "换一个操作对象看看" : "管理员的操作会记录在这里"}
          title="暂无审计记录"
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr>
                  <th className={cn(adminTh, "w-8 pr-0")}>
                    <span className="sr-only">展开</span>
                  </th>
                  <th className={adminTh}>时间</th>
                  <th className={adminTh}>操作</th>
                  <th className={adminTh}>对象</th>
                  <th className={adminTh}>管理员</th>
                  <th className={adminTh}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const open = expanded === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        aria-expanded={open}
                        className={cn(
                          adminRow,
                          "cursor-pointer",
                          open && "bg-gray-50/80 dark:bg-white/[0.03]",
                        )}
                        onClick={() => setExpanded(open ? undefined : log.id)}
                      >
                        <td className={cn(adminTd, "pr-0 text-gray-400")}>
                          <ChevronRight
                            className={cn("transition-transform duration-150", open && "rotate-90")}
                            size={14}
                          />
                        </td>
                        <td className={cn(adminTd, "whitespace-nowrap")}>
                          <span data-markai-tooltip={formatDateTime(log.createdAt)}>
                            {relative(log.createdAt)}
                          </span>
                        </td>
                        <td className={adminTd}>
                          <span
                            className={cn(
                              "inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium",
                              actionTone(log.action),
                            )}
                          >
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className={cn(adminTd, "text-gray-500")}>
                          {TARGET_LABELS[log.targetType] || log.targetType}
                          {log.targetId && (
                            <span className="ml-1.5 font-mono text-[11px] text-gray-400">
                              {log.targetId.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className={cn(adminTd, "max-w-[220px] truncate")}>
                          {log.actorEmail || log.actorUserId || "系统"}
                        </td>
                        <td className={cn(adminTd, "font-mono text-xs text-gray-400")}>
                          {log.ipAddress || "—"}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-gray-50/80 dark:bg-white/[0.03]">
                          <td />
                          <td className="px-4 pb-4 pt-1" colSpan={5}>
                            {detail(log)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-gray-100 md:hidden dark:divide-white/[0.06]">
            {logs.map((log) => {
              const open = expanded === log.id;
              return (
                <li key={log.id}>
                  <button
                    aria-expanded={open}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left"
                    onClick={() => setExpanded(open ? undefined : log.id)}
                    type="button"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium",
                            actionTone(log.action),
                          )}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        <span className="text-xs text-gray-500">
                          {TARGET_LABELS[log.targetType] || log.targetType}
                        </span>
                      </span>
                      <span className="mt-1.5 block truncate text-xs text-gray-500">
                        {log.actorEmail || log.actorUserId || "系统"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {relative(log.createdAt)}
                    </span>
                  </button>
                  {open && <div className="px-3 pb-3">{detail(log)}</div>}
                </li>
              );
            })}
          </ul>
          <AdminPagination
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            page={page}
            pageSize={pageSize}
            pageSizes={[20, 50, 100]}
            total={total}
            unit="条记录"
          />
        </>
      )}
    </AdminSurface>
  );
}
