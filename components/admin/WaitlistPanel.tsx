"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, MailPlus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  AdminButton,
  AdminCheckbox,
  AdminEmpty,
  AdminError,
  AdminFilterTabs,
  AdminLoading,
  AdminRefresh,
  AdminRowMenu,
  AdminSearch,
  AdminSelectionBar,
  AdminSurface,
  AdminToolbar,
  adminRow,
  adminTd,
  adminTh,
  formatDateTime,
  StatusBadge,
} from "@/components/admin/AdminPrimitives";
import { AppDialog } from "@/components/ui/AppDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

type WaitlistEntry = {
  email: string;
  fullName?: string;
  id: string;
  message?: string;
  requestedAt: string;
  reviewNote?: string;
  reviewerEmail?: string;
  status: string;
};

const statusLabels: Record<string, string> = {
  approved: "已批准",
  invited: "已邀请",
  pending: "待审批",
  registered: "已注册",
  rejected: "已拒绝",
};

export function WaitlistPanel() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<WaitlistEntry>();
  const [reviewNote, setReviewNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickAction, setQuickAction] = useState<{
    action: "approve" | "delete" | "reject";
    ids: string[];
    label: string;
  }>();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/admin/waitlist?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "等候名单加载失败");
      setEntries(data.entries || []);
      setSelectedIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "等候名单加载失败");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => void load(), [load]);

  const runAction = async (action: "approve" | "reject" | "resend" | "revoke") => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/waitlist/${selected.id}`, {
        body: JSON.stringify({ action, reviewNote }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作失败");
      toast.success(
        action === "reject"
          ? "申请已拒绝"
          : data.emailSent === false
            ? "状态已更新，但邀请邮件发送失败"
            : "邀请邮件已发送",
      );
      setSelected(undefined);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const runQuickAction = async () => {
    if (!quickAction) return;
    setActionLoading(true);
    try {
      const deleting = quickAction.action === "delete";
      const response = await fetch("/api/admin/waitlist", {
        body: JSON.stringify(
          deleting
            ? { ids: quickAction.ids }
            : { action: quickAction.action, ids: quickAction.ids },
        ),
        headers: { "Content-Type": "application/json" },
        method: deleting ? "DELETE" : "PATCH",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作失败");
      if (deleting) {
        toast.success(`已删除 ${data.deleted} 条等候名单记录`);
        setQuickAction(undefined);
        await load();
        return;
      }
      const suffix = [
        data.emailFailed ? `${data.emailFailed} 封邀请邮件发送失败` : "",
        data.skipped ? `${data.skipped} 条非待审批申请已跳过` : "",
        data.failed ? `${data.failed} 条处理失败` : "",
      ]
        .filter(Boolean)
        .join("，");
      toast.success(
        `已${quickAction.action === "approve" ? "批准" : "拒绝"} ${data.processed} 条申请${suffix ? `，${suffix}` : ""}`,
      );
      setQuickAction(undefined);
      await load();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const toggleAll = (checked: boolean) =>
    setSelectedIds(checked ? entries.map((entry) => entry.id) : []);
  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  const openDetail = (entry: WaitlistEntry) => {
    setReviewNote(entry.reviewNote || "");
    setSelected(entry);
  };
  const ask = (action: "approve" | "delete" | "reject", entry: WaitlistEntry) =>
    setQuickAction({ action, ids: [entry.id], label: entry.email });
  const rowMenu = (entry: WaitlistEntry) => [
    { icon: Eye, label: "查看详情", onClick: () => openDetail(entry) },
    ...(entry.status === "pending"
      ? [{ icon: X, label: "拒绝申请", onClick: () => ask("reject", entry) }]
      : []),
    { danger: true, icon: Trash2, label: "删除记录", onClick: () => ask("delete", entry) },
  ];
  const primaryAction = (entry: WaitlistEntry) =>
    entry.status === "pending" ? (
      <AdminButton compact success onClick={() => ask("approve", entry)}>
        <Check size={14} /> 批准
      </AdminButton>
    ) : (
      <AdminButton compact onClick={() => openDetail(entry)}>
        详情
      </AdminButton>
    );
  const bulk = (action: "approve" | "delete" | "reject") =>
    setQuickAction({
      action,
      ids: selectedIds,
      label: `${selectedIds.length} ${action === "delete" ? "条记录" : "条申请"}`,
    });

  return (
    <>
      <AdminSurface>
        <AdminToolbar actions={<AdminRefresh loading={loading} onClick={() => void load()} />}>
          <AdminSearch
            label="搜索等候名单"
            onChange={setSearch}
            placeholder="搜索邮箱或姓名"
            value={search}
          />
          <AdminFilterTabs
            label="申请状态"
            onChange={setStatus}
            options={[
              { label: "全部", value: "all" },
              { label: "待审批", value: "pending" },
              { label: "已邀请", value: "invited" },
              { label: "已批准", value: "approved" },
              { label: "已注册", value: "registered" },
              { label: "已拒绝", value: "rejected" },
            ]}
            value={status}
          />
        </AdminToolbar>
        <AdminSelectionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
          <AdminButton compact success onClick={() => bulk("approve")}>
            <Check size={14} /> 批准
          </AdminButton>
          <AdminButton compact onClick={() => bulk("reject")}>
            <X size={14} /> 拒绝
          </AdminButton>
          <AdminButton compact danger onClick={() => bulk("delete")}>
            <Trash2 size={14} /> 删除
          </AdminButton>
        </AdminSelectionBar>

        {loading ? (
          <AdminLoading rows={7} />
        ) : error ? (
          <AdminError message={error} onRetry={() => void load()} />
        ) : !entries.length ? (
          <AdminEmpty
            description={
              search || status !== "all" ? "调整搜索词或状态后再试" : "新的注册申请会出现在这里"
            }
            title={search || status !== "all" ? "没有符合条件的申请" : "暂无等候名单申请"}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr>
                    <th className={cn(adminTh, "w-10 pr-0")}>
                      <AdminCheckbox
                        checked={allSelected}
                        indeterminate={selectedIds.length > 0 && !allSelected}
                        label="全选当前等候名单记录"
                        onChange={toggleAll}
                      />
                    </th>
                    <th className={adminTh}>申请人</th>
                    <th className={adminTh}>状态</th>
                    <th className={adminTh}>申请说明</th>
                    <th className={adminTh}>申请时间</th>
                    <th className={cn(adminTh, "text-right")}>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      className={cn(
                        adminRow,
                        "cursor-pointer",
                        selectedIds.includes(entry.id) && "bg-gray-50 dark:bg-white/[0.03]",
                      )}
                      key={entry.id}
                      onClick={() => openDetail(entry)}
                    >
                      <td
                        className={cn(adminTd, "pr-0")}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <AdminCheckbox
                          checked={selectedIds.includes(entry.id)}
                          label={`选择申请 ${entry.email}`}
                          onChange={(checked) => toggleOne(entry.id, checked)}
                        />
                      </td>
                      <td className={adminTd}>
                        <p className="font-medium">{entry.fullName || entry.email.split("@")[0]}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{entry.email}</p>
                      </td>
                      <td className={adminTd}>
                        <StatusBadge label={statusLabels[entry.status]} status={entry.status} />
                      </td>
                      <td className={cn(adminTd, "max-w-xs")}>
                        <p
                          className="truncate text-gray-500"
                          data-markai-tooltip={entry.message || undefined}
                        >
                          {entry.message || (
                            <span className="text-gray-300 dark:text-gray-600">未填写</span>
                          )}
                        </p>
                      </td>
                      <td className={cn(adminTd, "whitespace-nowrap text-xs text-gray-500")}>
                        {formatDateTime(entry.requestedAt)}
                      </td>
                      <td
                        className={cn(adminTd, "py-2")}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          {primaryAction(entry)}
                          <AdminRowMenu items={rowMenu(entry)} label={`${entry.email} 更多操作`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden">
              <div className="flex min-h-11 items-center gap-2 border-b border-gray-100 px-3 text-xs text-gray-500 dark:border-white/[0.06]">
                <AdminCheckbox
                  checked={allSelected}
                  indeterminate={selectedIds.length > 0 && !allSelected}
                  label="全选当前等候名单记录"
                  onChange={toggleAll}
                />
                全选 {entries.length} 条
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                {entries.map((entry) => (
                  <li className="flex items-start gap-3 px-3 py-3" key={entry.id}>
                    <span className="pt-0.5">
                      <AdminCheckbox
                        checked={selectedIds.includes(entry.id)}
                        label={`选择申请 ${entry.email}`}
                        onChange={(checked) => toggleOne(entry.id, checked)}
                      />
                    </span>
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openDetail(entry)}
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {entry.fullName || entry.email.split("@")[0]}
                        </span>
                        <StatusBadge label={statusLabels[entry.status]} status={entry.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-400">
                        {entry.email}
                      </span>
                      {entry.message && (
                        <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-gray-500">
                          {entry.message}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-gray-400">
                        {formatDateTime(entry.requestedAt)}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center">
                      {entry.status === "pending" && (
                        <AdminButton compact success onClick={() => ask("approve", entry)}>
                          批准
                        </AdminButton>
                      )}
                      <AdminRowMenu items={rowMenu(entry)} label={`${entry.email} 更多操作`} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </AdminSurface>

      <AppDialog
        closeDisabled={actionLoading}
        onClose={() => setSelected(undefined)}
        open={!!selected}
        title="审批等候名单"
        width={560}
      >
        {selected && (
          <div className="space-y-5 p-4 sm:p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{selected.fullName || "未填写姓名"}</p>
                  <p className="mt-1 text-sm text-gray-500">{selected.email}</p>
                </div>
                <StatusBadge label={statusLabels[selected.status]} status={selected.status} />
              </div>
              {selected.message && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {selected.message}
                </p>
              )}
            </div>
            <label className="block text-sm font-medium">
              审核备注
              <textarea
                className="mt-2 min-h-24 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-[var(--chat-input-bg)]"
                maxLength={500}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="选填，仅管理员可见"
                value={reviewNote}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {selected.status === "pending" && (
                <>
                  <AdminButton
                    danger
                    loading={actionLoading}
                    onClick={() => void runAction("reject")}
                  >
                    <X size={15} /> 拒绝
                  </AdminButton>
                  <AdminButton
                    success
                    loading={actionLoading}
                    onClick={() => void runAction("approve")}
                  >
                    <Check size={15} /> 批准并发送邀请
                  </AdminButton>
                </>
              )}
              {selected.status === "invited" && (
                <>
                  <AdminButton
                    danger
                    loading={actionLoading}
                    onClick={() => void runAction("revoke")}
                  >
                    撤销邀请
                  </AdminButton>
                  <AdminButton
                    loading={actionLoading}
                    onClick={() => void runAction("resend")}
                    primary
                  >
                    <MailPlus size={15} /> 重新发送
                  </AdminButton>
                </>
              )}
            </div>
          </div>
        )}
      </AppDialog>
      <ConfirmDialog
        confirmText={
          quickAction?.action === "approve"
            ? "批准并发送邀请"
            : quickAction?.action === "delete"
              ? "永久删除"
              : "拒绝申请"
        }
        danger={quickAction?.action !== "approve"}
        description={
          quickAction?.action === "approve"
            ? `确定批准“${quickAction.label}”吗？系统将为每条申请创建一次性邀请链接，并向对应邮箱发送邀请邮件。`
            : quickAction?.action === "delete"
              ? `确定永久删除“${quickAction.label}”吗？关联的历史邀请链接也会一并删除，此操作不可撤销。`
              : `确定拒绝“${quickAction?.label || ""}”吗？拒绝后申请状态会立即更新。`
        }
        loading={actionLoading}
        onCancel={() => setQuickAction(undefined)}
        onConfirm={() => void runQuickAction()}
        open={!!quickAction}
        success={quickAction?.action === "approve"}
        title={
          quickAction?.action === "approve"
            ? "确认批准申请？"
            : quickAction?.action === "delete"
              ? "删除等候名单记录？"
              : "确认拒绝申请？"
        }
      />
    </>
  );
}
