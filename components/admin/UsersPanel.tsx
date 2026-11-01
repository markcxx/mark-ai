"use client";

import { UserMembershipCell } from "./UserMembershipCell";
import { useCallback, useEffect, useState } from "react";
import { Ban, Eye, ShieldCheck, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  AdminButton,
  AdminCheckbox,
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminRefresh,
  AdminRowMenu,
  AdminSearch,
  AdminSelectionBar,
  AdminSurface,
  AdminToolbar,
  adminRow,
  adminTd,
  adminTh,
  formatBytes,
  formatDateTime,
  StatusBadge,
} from "@/components/admin/AdminPrimitives";
import { UserManagementDrawer } from "@/components/admin/UserDetailDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AppSelect } from "@/components/ui/AppSelect";
import { cn } from "@/lib/utils";
import type { UserPlatformUsage } from "@/lib/client-platform";
import { UserPlatformBadges } from "./UserPlatforms";

export type AdminUserSummary = {
  membership?: { tier: string; expiresAt: string | null };
  platforms?: UserPlatformUsage[];
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
  const [platform, setPlatform] = useState("all");
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      if (role !== "all") params.set("role", role);
      if (status !== "all") params.set("status", status);
      if (platform !== "all") params.set("platform", platform);
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
  }, [page, pageSize, role, search, status, platform]);

  useEffect(() => void load(), [load]);

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

  const allSelected = users.length > 0 && selectedIds.length === users.length;
  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  const displayName = (user: AdminUserSummary) =>
    user.fullName || user.username || user.email.split("@")[0];
  const rowMenu = (user: AdminUserSummary) => [
    { icon: Eye, label: "查看详情", onClick: () => setSelectedUserId(user.id) },
    {
      icon: user.banned ? ShieldCheck : Ban,
      label: user.banned ? "解除封禁" : "封禁用户",
      onClick: () => setBanTarget({ banned: !user.banned, ids: [user.id], label: user.email }),
    },
    {
      danger: true,
      icon: Trash2,
      label: "删除用户",
      onClick: () => setDeleteTarget({ id: user.id, label: user.email }),
    },
  ];
  const filtering =
    Boolean(search.trim()) || role !== "all" || status !== "all" || platform !== "all";
  const filterSelect = (
    label: string,
    value: string,
    setter: (value: string) => void,
    options: { label: string; value: string }[],
  ) => (
    <div className="w-[calc(50%-4px)] shrink-0 sm:w-32">
      <AppSelect<string>
        aria-label={label}
        classNames={{ trigger: "min-h-10 md:min-h-9" }}
        onChange={(next) => {
          setter(next);
          setPage(1);
        }}
        options={options}
        style={{ width: "100%" }}
        value={value}
      />
    </div>
  );
  const avatar = (user: AdminUserSummary) => (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-medium text-gray-500 dark:bg-white/[0.08] dark:text-gray-300">
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" src={user.avatar} />
      ) : (
        displayName(user).slice(0, 1).toUpperCase()
      )}
    </span>
  );

  return (
    <div>
      <AdminSurface>
        <AdminToolbar actions={<AdminRefresh loading={loading} onClick={() => void load()} />}>
          <AdminSearch
            label="搜索用户"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="搜索邮箱、昵称或用户名"
            value={search}
          />
          {filterSelect("按角色筛选", role, setRole, [
            { label: "全部角色", value: "all" },
            { label: "普通用户", value: "user" },
            { label: "管理员", value: "admin" },
          ])}
          {filterSelect("按状态筛选", status, setStatus, [
            { label: "全部状态", value: "all" },
            { label: "正常", value: "active" },
            { label: "已封禁", value: "banned" },
          ])}
          {filterSelect("按使用平台筛选", platform, setPlatform, [
            { label: "全部平台", value: "all" },
            { label: "Web", value: "web" },
            { label: "Android", value: "android" },
            { label: "未知平台", value: "unknown" },
          ])}
        </AdminToolbar>
        <AdminSelectionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
          <AdminButton
            compact
            onClick={() =>
              setBanTarget({
                banned: true,
                ids: selectedIds,
                label: `${selectedIds.length} 位用户`,
              })
            }
          >
            <Ban size={14} /> 封禁
          </AdminButton>
          <AdminButton
            compact
            onClick={() =>
              setBanTarget({
                banned: false,
                ids: selectedIds,
                label: `${selectedIds.length} 位用户`,
              })
            }
          >
            <ShieldCheck size={14} /> 解封
          </AdminButton>
          <AdminButton
            compact
            danger
            onClick={() => setDeleteTarget({ label: `${selectedIds.length} 位用户` })}
          >
            <Trash2 size={14} /> 删除
          </AdminButton>
        </AdminSelectionBar>

        {loading ? (
          <AdminLoading rows={7} />
        ) : error ? (
          <AdminError message={error} onRetry={() => void load()} />
        ) : !users.length ? (
          <AdminEmpty
            description={filtering ? "调整搜索词或筛选条件后再试" : undefined}
            title={filtering ? "没有符合条件的用户" : "暂无用户"}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr>
                    <th className={cn(adminTh, "w-10 pr-0")}>
                      <AdminCheckbox
                        checked={allSelected}
                        indeterminate={selectedIds.length > 0 && !allSelected}
                        label="全选当前页用户"
                        onChange={(checked) =>
                          setSelectedIds(checked ? users.map((u) => u.id) : [])
                        }
                      />
                    </th>
                    <th className={adminTh}>用户</th>
                    <th className={adminTh}>会员</th>
                    <th className={adminTh}>状态</th>
                    <th className={cn(adminTh, "text-right")}>对话</th>
                    <th className={cn(adminTh, "text-right")}>文件</th>
                    <th className={adminTh}>最近活动</th>
                    <th className={adminTh}>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      className={cn(
                        adminRow,
                        selectedIds.includes(user.id) && "bg-gray-50 dark:bg-white/[0.03]",
                      )}
                      key={user.id}
                    >
                      <td className={cn(adminTd, "pr-0")}>
                        <AdminCheckbox
                          checked={selectedIds.includes(user.id)}
                          label={`选择用户 ${user.email}`}
                          onChange={(checked) => toggleOne(user.id, checked)}
                        />
                      </td>
                      <td className={adminTd}>
                        <button
                          className="flex min-w-0 items-center gap-3 text-left"
                          onClick={() => setSelectedUserId(user.id)}
                          type="button"
                        >
                          {avatar(user)}
                          <span className="min-w-0">
                            <span className="block truncate font-medium hover:underline">
                              {displayName(user)}
                            </span>
                            <span className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                              <span className="truncate">{user.email}</span>
                              <UserPlatformBadges platforms={user.platforms} />
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className={cn(adminTd, "py-2")}>
                        <UserMembershipCell membership={user.membership} userId={user.id} />
                      </td>
                      <td className={adminTd}>
                        <div className="flex flex-wrap gap-1">
                          {user.role === "admin" && <StatusBadge label="管理员" status="admin" />}
                          <StatusBadge
                            label={user.banned ? "已封禁" : "正常"}
                            status={user.banned ? "banned" : "active"}
                          />
                        </div>
                      </td>
                      <td
                        className={cn(
                          adminTd,
                          "text-right font-jakarta tabular-nums text-gray-600 dark:text-gray-300",
                        )}
                      >
                        {user.sessionCount}
                      </td>
                      <td
                        className={cn(
                          adminTd,
                          "whitespace-nowrap text-right font-jakarta tabular-nums text-gray-600 dark:text-gray-300",
                        )}
                      >
                        {user.fileCount}
                        <span className="ml-1 text-[11px] text-gray-400">
                          {formatBytes(user.fileBytes)}
                        </span>
                      </td>
                      <td className={cn(adminTd, "whitespace-nowrap text-xs text-gray-500")}>
                        <p>{formatDateTime(user.lastActiveAt)}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          注册于 {formatDateTime(user.createdAt).split(" ")[0]}
                        </p>
                      </td>
                      <td className={cn(adminTd, "py-2 text-right")}>
                        <AdminRowMenu items={rowMenu(user)} label={`${user.email} 更多操作`} />
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
                  label="全选当前页用户"
                  onChange={(checked) => setSelectedIds(checked ? users.map((u) => u.id) : [])}
                />
                全选本页 {users.length} 位
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                {users.map((user) => (
                  <li className="px-3 py-3" key={user.id}>
                    <div className="flex items-start gap-3">
                      <span className="pt-1.5">
                        <AdminCheckbox
                          checked={selectedIds.includes(user.id)}
                          label={`选择用户 ${user.email}`}
                          onChange={(checked) => toggleOne(user.id, checked)}
                        />
                      </span>
                      <button
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => setSelectedUserId(user.id)}
                        type="button"
                      >
                        {avatar(user)}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                              {displayName(user)}
                            </span>
                            {user.role === "admin" && <StatusBadge label="管理员" status="admin" />}
                            {user.banned && <StatusBadge label="已封禁" status="banned" />}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-gray-400">
                            {user.email}
                          </span>
                          <span className="mt-1.5 block text-[11px] text-gray-400">
                            {user.sessionCount} 个对话 · {user.fileCount} 个文件 ·{" "}
                            {formatBytes(user.fileBytes)}
                          </span>
                        </span>
                      </button>
                      <AdminRowMenu items={rowMenu(user)} label={`${user.email} 更多操作`} />
                    </div>
                    <div className="mt-2 overflow-x-auto pl-8">
                      <UserMembershipCell membership={user.membership} userId={user.id} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <AdminPagination
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              page={page}
              pageSize={pageSize}
              total={total}
              unit="位用户"
            />
          </>
        )}
      </AdminSurface>
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
