"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, MailPlus, RefreshCw, Search, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  AdminButton,
  AdminCheckbox,
  AdminError,
  AdminLoading,
  adminInputClass,
  formatDateTime,
  StatusBadge,
} from "@/components/admin/AdminPrimitives";
import { AppDialog } from "@/components/ui/AppDialog";
import { AppSelect } from "@/components/ui/AppSelect";
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

  const selectableEntries = entries;

  return (
    <>
      <div>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              className={`${adminInputClass} pl-9`}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索邮箱或姓名"
              value={search}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:w-auto md:items-center">
            <div className="min-w-0 md:w-40">
              <AppSelect
                onChange={(value) => typeof value === "string" && setStatus(value)}
                options={[
                  { label: "全部状态", value: "all" },
                  { label: "待审批", value: "pending" },
                  { label: "已批准", value: "approved" },
                  { label: "已邀请", value: "invited" },
                  { label: "已注册", value: "registered" },
                  { label: "已拒绝", value: "rejected" },
                ]}
                style={{ width: "100%" }}
                value={status}
              />
            </div>
            <AdminButton onClick={() => void load()}>
              <RefreshCw size={15} /> <span className="hidden sm:inline">刷新</span>
            </AdminButton>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex w-full items-center gap-0.5 overflow-x-auto pb-1 md:w-auto md:pb-0">
              <AdminButton
                success
                onClick={() =>
                  setQuickAction({
                    action: "approve",
                    ids: selectedIds,
                    label: `${selectedIds.length} 条申请`,
                  })
                }
              >
                <Check size={14} /> 批量批准
              </AdminButton>
              <AdminButton
                danger
                onClick={() =>
                  setQuickAction({
                    action: "reject",
                    ids: selectedIds,
                    label: `${selectedIds.length} 条申请`,
                  })
                }
              >
                <X size={14} /> 批量拒绝
              </AdminButton>
              <AdminButton
                danger
                onClick={() =>
                  setQuickAction({
                    action: "delete",
                    ids: selectedIds,
                    label: `${selectedIds.length} 条记录`,
                  })
                }
              >
                <Trash2 size={14} /> 批量删除
              </AdminButton>
            </div>
          )}
        </div>

        {loading ? (
          <AdminLoading rows={7} />
        ) : error ? (
          <AdminError message={error} onRetry={() => void load()} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="text-xs text-gray-400">
                  <tr>
                    <th className="w-12 px-3 py-3">
                      <AdminCheckbox
                        checked={
                          selectableEntries.length > 0 &&
                          selectedIds.length === selectableEntries.length
                        }
                        disabled={!selectableEntries.length}
                        indeterminate={
                          selectedIds.length > 0 && selectedIds.length < selectableEntries.length
                        }
                        label="全选当前等候名单记录"
                        onChange={(checked) =>
                          setSelectedIds(checked ? selectableEntries.map((entry) => entry.id) : [])
                        }
                      />
                    </th>
                    <th className="px-5 py-3 font-medium">申请人</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                    <th className="px-5 py-3 font-medium">申请时间</th>
                    <th className="px-5 py-3 font-medium">申请说明</th>
                    <th className="px-5 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      className={cn(
                        "transition-colors hover:bg-gray-100/80 dark:hover:bg-white/[0.06]",
                        index % 2 === 0 && "bg-gray-50/55 dark:bg-white/[0.018]",
                      )}
                      key={entry.id}
                    >
                      <td className="px-3 py-3">
                        <AdminCheckbox
                          checked={selectedIds.includes(entry.id)}
                          label={`选择申请 ${entry.email}`}
                          onChange={(checked) =>
                            setSelectedIds((current) =>
                              checked
                                ? [...current, entry.id]
                                : current.filter((id) => id !== entry.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{entry.fullName || entry.email.split("@")[0]}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{entry.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label={statusLabels[entry.status]} status={entry.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                        {formatDateTime(entry.requestedAt)}
                      </td>
                      <td className="max-w-xs truncate px-5 py-3 text-gray-500">
                        {entry.message || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <AdminButton
                            compact
                            onClick={() => {
                              setReviewNote(entry.reviewNote || "");
                              setSelected(entry);
                            }}
                          >
                            <Eye size={14} /> 详情
                          </AdminButton>
                          {entry.status === "pending" && (
                            <>
                              <AdminButton
                                compact
                                success
                                onClick={() =>
                                  setQuickAction({
                                    action: "approve",
                                    ids: [entry.id],
                                    label: entry.email,
                                  })
                                }
                              >
                                <Check size={14} /> 批准
                              </AdminButton>
                              <AdminButton
                                compact
                                danger
                                onClick={() =>
                                  setQuickAction({
                                    action: "reject",
                                    ids: [entry.id],
                                    label: entry.email,
                                  })
                                }
                              >
                                <X size={14} /> 拒绝
                              </AdminButton>
                            </>
                          )}
                          <AdminButton
                            compact
                            danger
                            onClick={() =>
                              setQuickAction({
                                action: "delete",
                                ids: [entry.id],
                                label: entry.email,
                              })
                            }
                          >
                            <Trash2 size={14} /> 删除
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !entries.length && (
                    <tr>
                      <td className="px-5 py-14 text-center text-gray-400" colSpan={6}>
                        暂无等候名单申请
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              <div className="flex items-center gap-2 px-1 pb-1 text-xs text-gray-500">
                <AdminCheckbox
                  checked={
                    selectableEntries.length > 0 && selectedIds.length === selectableEntries.length
                  }
                  disabled={!selectableEntries.length}
                  indeterminate={
                    selectedIds.length > 0 && selectedIds.length < selectableEntries.length
                  }
                  label="全选当前等候名单记录"
                  onChange={(checked) =>
                    setSelectedIds(checked ? selectableEntries.map((entry) => entry.id) : [])
                  }
                />
                全选当前列表
              </div>
              {entries.map((entry) => (
                <article
                  className="rounded-xl bg-gray-50/80 p-3.5 dark:bg-white/[0.035]"
                  key={entry.id}
                >
                  <div className="flex items-start gap-3">
                    <AdminCheckbox
                      checked={selectedIds.includes(entry.id)}
                      label={`选择申请 ${entry.email}`}
                      onChange={(checked) =>
                        setSelectedIds((current) =>
                          checked
                            ? [...current, entry.id]
                            : current.filter((id) => id !== entry.id),
                        )
                      }
                    />
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setReviewNote(entry.reviewNote || "");
                        setSelected(entry);
                      }}
                      type="button"
                    >
                      <p className="truncate text-sm font-semibold">
                        {entry.fullName || entry.email.split("@")[0]}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-400">{entry.email}</p>
                    </button>
                    <StatusBadge label={statusLabels[entry.status]} status={entry.status} />
                  </div>
                  {entry.message && (
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {entry.message}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-gray-400">
                    申请于 {formatDateTime(entry.requestedAt)}
                  </p>
                  <div className="mt-2 flex items-center gap-0.5 border-t border-gray-200/70 pt-2 dark:border-white/[0.07]">
                    <AdminButton
                      compact
                      onClick={() => {
                        setReviewNote(entry.reviewNote || "");
                        setSelected(entry);
                      }}
                    >
                      <Eye size={14} /> 详情
                    </AdminButton>
                    {entry.status === "pending" && (
                      <>
                        <AdminButton
                          compact
                          success
                          onClick={() =>
                            setQuickAction({
                              action: "approve",
                              ids: [entry.id],
                              label: entry.email,
                            })
                          }
                        >
                          <Check size={14} /> 批准
                        </AdminButton>
                        <AdminButton
                          compact
                          danger
                          onClick={() =>
                            setQuickAction({
                              action: "reject",
                              ids: [entry.id],
                              label: entry.email,
                            })
                          }
                        >
                          <X size={14} /> 拒绝
                        </AdminButton>
                      </>
                    )}
                    <AdminButton
                      compact
                      danger
                      onClick={() =>
                        setQuickAction({
                          action: "delete",
                          ids: [entry.id],
                          label: entry.email,
                        })
                      }
                    >
                      <Trash2 size={14} /> 删除
                    </AdminButton>
                  </div>
                </article>
              ))}
              {!entries.length && (
                <p className="py-12 text-center text-sm text-gray-400">暂无等候名单申请</p>
              )}
            </div>
          </>
        )}
      </div>

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
