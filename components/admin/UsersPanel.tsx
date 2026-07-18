"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  AdminButton,
  AdminCheckbox,
  AdminError,
  AdminLoading,
  adminInputClass,
  formatBytes,
  formatDateTime,
  StatusBadge,
} from "@/components/admin/AdminPrimitives";
import { UserManagementDrawer } from "@/components/admin/UserDetailDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AppSelect } from "@/components/ui/AppSelect";
import { cn } from "@/lib/utils";

export type AdminUserSummary = {
  age?: number;
  avatar?: string;
  banned?: boolean;
  createdAt: string;
  email: string;
  emailVerified: boolean;
  fileBytes: number;
  fileCount: number;
  fullName?: string;
  id: string;
  lastActiveAt?: string;
  role?: string;
  sessionCount: number;
  username?: string;
};

export function UsersPanel() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; label: string }>();
  const [banTarget, setBanTarget] = useState<{
    banned: boolean;
    ids: string[];
    label: string;
  }>();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      if (role !== "all") params.set("role", role);
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "用户列表加载失败");
      setUsers(data.users || []);
      setTotal(Number(data.total || 0));
      setSelectedIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "用户列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, role, search, status]);

  useEffect(() => void load(), [load]);

  const pageItems = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, pageCount]);

  const confirmBan = async () => {
    if (!banTarget) return;
    setActionLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify({
          action: banTarget.banned ? "ban" : "unban",
          ids: banTarget.ids,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作失败");
      toast.success(
        data.skipped
          ? `已${banTarget.banned ? "封禁" : "解封"} ${data.updated} 位用户，${data.skipped} 位受保护用户已跳过`
          : `已${banTarget.banned ? "封禁" : "解封"} ${data.updated} 位用户`,
      );
      setBanTarget(undefined);
      setSelectedIds([]);
      await load();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    const ids = deleteTarget.id ? [deleteTarget.id] : selectedIds;
    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify({ ids }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除失败");
      toast.success(
        data.skipped
          ? `已删除 ${data.deleted} 位用户，${data.skipped} 位受保护用户已跳过`
          : `已删除 ${data.deleted} 位用户`,
      );
      setDeleteTarget(undefined);
      setSelectedIds([]);
      if (page > 1 && users.length <= ids.length) setPage(page - 1);
      else await load();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "删除失败");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            className={`${adminInputClass} pl-9`}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="搜索邮箱、昵称或用户名"
            value={search}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 lg:flex lg:w-auto lg:items-center">
          <div className="min-w-0 lg:w-36">
            <AppSelect
              onChange={(value) => {
                if (typeof value !== "string") return;
                setRole(value);
                setPage(1);
              }}
              options={[
                { label: "全部角色", value: "all" },
                { label: "普通用户", value: "user" },
                { label: "管理员", value: "admin" },
              ]}
              style={{ width: "100%" }}
              value={role}
            />
          </div>
          <div className="min-w-0 lg:w-36">
            <AppSelect
              onChange={(value) => {
                if (typeof value !== "string") return;
                setStatus(value);
                setPage(1);
              }}
              options={[
                { label: "全部状态", value: "all" },
                { label: "正常", value: "active" },
                { label: "已封禁", value: "banned" },
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
          <div className="flex w-full items-center gap-1 overflow-x-auto pb-1 lg:w-auto lg:pb-0">
            <AdminButton
              onClick={() =>
                setBanTarget({
                  banned: true,
                  ids: selectedIds,
                  label: `${selectedIds.length} 位用户`,
                })
              }
            >
              <Ban size={14} /> 批量封禁
            </AdminButton>
            <AdminButton
              onClick={() =>
                setBanTarget({
                  banned: false,
                  ids: selectedIds,
                  label: `${selectedIds.length} 位用户`,
                })
              }
            >
              <ShieldCheck size={14} /> 批量解封
            </AdminButton>
            <AdminButton
              danger
              onClick={() => setDeleteTarget({ label: `${selectedIds.length} 位用户` })}
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
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="text-xs text-gray-400">
                <tr>
                  <th className="w-12 px-3 py-3">
                    <AdminCheckbox
                      checked={users.length > 0 && selectedIds.length === users.length}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
                      label="全选当前页用户"
                      onChange={(checked) =>
                        setSelectedIds(checked ? users.map((user) => user.id) : [])
                      }
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">用户</th>
                  <th className="px-5 py-3 font-medium">角色</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">对话</th>
                  <th className="px-5 py-3 font-medium">文件</th>
                  <th className="px-5 py-3 font-medium">最近活动</th>
                  <th className="px-5 py-3 font-medium">注册时间</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr
                    className={cn(
                      "transition-colors hover:bg-gray-100/80 dark:hover:bg-white/[0.06]",
                      index % 2 === 0 && "bg-gray-50/55 dark:bg-white/[0.018]",
                    )}
                    key={user.id}
                  >
                    <td className="px-3 py-3">
                      <AdminCheckbox
                        checked={selectedIds.includes(user.id)}
                        label={`选择用户 ${user.email}`}
                        onChange={(checked) =>
                          setSelectedIds((current) =>
                            checked
                              ? [...current, user.id]
                              : current.filter((id) => id !== user.id),
                          )
                        }
                      />
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">
                        {user.fullName || user.username || user.email.split("@")[0]}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">{user.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={user.role === "admin" ? "管理员" : "用户"}
                        status={user.role || "user"}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge
                        label={user.banned ? "已封禁" : "正常"}
                        status={user.banned ? "banned" : "active"}
                      />
                    </td>
                    <td className="px-5 py-3 text-gray-500">{user.sessionCount}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {user.fileCount} · {formatBytes(user.fileBytes)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                      {formatDateTime(user.lastActiveAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <AdminButton compact onClick={() => setSelectedUserId(user.id)}>
                          <Eye size={14} /> 详情
                        </AdminButton>
                        <AdminButton
                          compact
                          disabled={actionLoading}
                          onClick={() =>
                            setBanTarget({
                              banned: !user.banned,
                              ids: [user.id],
                              label: user.email,
                            })
                          }
                        >
                          {user.banned ? <ShieldCheck size={14} /> : <Ban size={14} />}
                          {user.banned ? "解封" : "封禁"}
                        </AdminButton>
                        <AdminButton
                          compact
                          danger
                          disabled={actionLoading}
                          onClick={() => setDeleteTarget({ id: user.id, label: user.email })}
                        >
                          <Trash2 size={14} /> 删除
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !users.length && (
                  <tr>
                    <td className="px-5 py-14 text-center text-gray-400" colSpan={9}>
                      没有符合条件的用户
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            <div className="flex items-center gap-2 px-1 pb-1 text-xs text-gray-500">
              <AdminCheckbox
                checked={users.length > 0 && selectedIds.length === users.length}
                indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
                label="全选当前页用户"
                onChange={(checked) => setSelectedIds(checked ? users.map((user) => user.id) : [])}
              />
              全选当前页
            </div>
            {users.map((user) => (
              <article
                className="rounded-xl bg-gray-50/80 p-3.5 dark:bg-white/[0.035]"
                key={user.id}
              >
                <div className="flex items-start gap-3">
                  <AdminCheckbox
                    checked={selectedIds.includes(user.id)}
                    label={`选择用户 ${user.email}`}
                    onChange={(checked) =>
                      setSelectedIds((current) =>
                        checked ? [...current, user.id] : current.filter((id) => id !== user.id),
                      )
                    }
                  />
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedUserId(user.id)}
                    type="button"
                  >
                    <p className="truncate text-sm font-semibold">
                      {user.fullName || user.username || user.email.split("@")[0]}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">{user.email}</p>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <StatusBadge
                      label={user.role === "admin" ? "管理员" : "用户"}
                      status={user.role || "user"}
                    />
                    <StatusBadge
                      label={user.banned ? "已封禁" : "正常"}
                      status={user.banned ? "banned" : "active"}
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400">对话</p>
                    <p className="mt-1 font-medium">{user.sessionCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">文件</p>
                    <p className="mt-1 truncate font-medium">{user.fileCount} 个</p>
                  </div>
                  <div>
                    <p className="text-gray-400">存储</p>
                    <p className="mt-1 truncate font-medium">{formatBytes(user.fileBytes)}</p>
                  </div>
                </div>
                <p className="mt-3 truncate text-[11px] text-gray-400">
                  最近活动：{formatDateTime(user.lastActiveAt)}
                </p>
                <div className="mt-2 flex items-center gap-0.5 border-t border-gray-200/70 pt-2 dark:border-white/[0.07]">
                  <AdminButton compact onClick={() => setSelectedUserId(user.id)}>
                    <Eye size={14} /> 详情
                  </AdminButton>
                  <AdminButton
                    compact
                    disabled={actionLoading}
                    onClick={() =>
                      setBanTarget({
                        banned: !user.banned,
                        ids: [user.id],
                        label: user.email,
                      })
                    }
                  >
                    {user.banned ? <ShieldCheck size={14} /> : <Ban size={14} />}
                    {user.banned ? "解封" : "封禁"}
                  </AdminButton>
                  <AdminButton
                    compact
                    danger
                    disabled={actionLoading}
                    onClick={() => setDeleteTarget({ id: user.id, label: user.email })}
                  >
                    <Trash2 size={14} /> 删除
                  </AdminButton>
                </div>
              </article>
            ))}
            {!users.length && (
              <p className="py-12 text-center text-sm text-gray-400">没有符合条件的用户</p>
            )}
          </div>
        </>
      )}
      {!loading && !error && total > 0 && (
        <div className="mt-5 flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            共 {total} 位用户 · 第 {page}/{pageCount} 页
          </p>
          <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
            <AppSelect
              onChange={(value) => {
                if (typeof value !== "number") return;
                setPageSize(value);
                setPage(1);
              }}
              options={[
                { label: "每页 20 条", value: 20 },
                { label: "每页 50 条", value: 50 },
                { label: "每页 100 条", value: 100 },
              ]}
              style={{ flex: 1, minWidth: 0, width: 126 }}
              value={pageSize}
            />
            <AdminButton disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeft size={14} />
            </AdminButton>
            {pageItems.map((item) => (
              <button
                className={cn(
                  "hidden h-9 min-w-9 rounded-lg px-2 text-sm transition-colors sm:block",
                  item === page
                    ? "bg-primary text-white"
                    : "hover:bg-gray-100 dark:hover:bg-white/[0.06]",
                )}
                key={item}
                onClick={() => setPage(item)}
                type="button"
              >
                {item}
              </button>
            ))}
            <AdminButton disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
              <ChevronRight size={14} />
            </AdminButton>
          </div>
        </div>
      )}
      <UserManagementDrawer
        onChanged={() => void load()}
        onClose={() => setSelectedUserId(undefined)}
        open={!!selectedUserId}
        userId={selectedUserId}
      />
      <ConfirmDialog
        description={`将永久删除“${deleteTarget?.label || ""}”及其账户、登录会话、聊天消息、设置、模型配置和全部对象存储文件。受保护的管理员账户会自动跳过。`}
        loading={actionLoading}
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={() => void confirmDelete()}
        open={!!deleteTarget}
        title={deleteTarget?.id ? "删除该用户及全部数据？" : "批量删除用户及全部数据？"}
      />
      <ConfirmDialog
        description={
          banTarget?.banned
            ? `封禁“${banTarget.label}”后，对应用户将无法继续正常使用账户。当前管理员和环境变量管理员会自动跳过。`
            : `确定解除“${banTarget?.label || ""}”的封禁状态吗？`
        }
        loading={actionLoading}
        onCancel={() => setBanTarget(undefined)}
        onConfirm={() => void confirmBan()}
        open={!!banTarget}
        title={banTarget?.banned ? "确认封禁用户？" : "确认解除封禁？"}
      />
    </div>
  );
}
