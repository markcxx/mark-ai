"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageSquareText,
  Save,
  Shield,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
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
import { FilePreviewDialog } from "@/components/chat/FilePreviewDialog";
import { AppDialog } from "@/components/ui/AppDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AppSelect } from "@/components/ui/AppSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/utils";

type UserDetail = {
  accounts: Array<{ createdAt: string; providerId: string }>;
  loginSessions: Array<{
    createdAt: string;
    expiresAt: string;
    id: string;
    ipAddress?: string;
    updatedAt: string;
    userAgent?: string;
  }>;
  user: {
    age?: number;
    banExpires?: string;
    banned?: boolean;
    banReason?: string;
    createdAt: string;
    email: string;
    emailVerified: boolean;
    fullName?: string;
    id: string;
    profileCompleted: boolean;
    role?: string;
    updatedAt: string;
    username?: string;
  };
};

type StoredFile = {
  contentType: string;
  createdAt: string;
  id: string;
  originalName: string;
  size: number;
  status: string;
};

type Conversation = {
  createdAt: string;
  id: string;
  model?: string;
  provider?: string;
  title: string;
  updatedAt: string;
};

type ConversationMessage = { content: string; createdAt?: string; id: string; role: string };
type Tab = "conversations" | "files" | "profile" | "security";

const tabs = [
  { label: "资料", value: "profile" as const },
  { label: "安全", value: "security" as const },
  { label: "文件", value: "files" as const },
  { label: "对话", value: "conversations" as const },
];

export function UserManagementView({
  onChanged,
  onBack,
  showHeader = true,
  userId,
}: {
  onChanged: () => void;
  onBack: () => void;
  showHeader?: boolean;
  userId: string;
}) {
  const [detail, setDetail] = useState<UserDetail>();
  const [detailError, setDetailError] = useState("");
  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [filePreview, setFilePreview] = useState<StoredFile>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<string[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation>();
  const [conversationDetailLoading, setConversationDetailLoading] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    kind: "conversation" | "conversations" | "file" | "files" | "user";
    label: string;
  }>();

  const loadDetail = useCallback(async () => {
    setDetailError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "用户详情加载失败");
      setDetail(data);
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : "用户详情加载失败");
    }
  }, [userId]);

  useEffect(() => {
    setDetail(undefined);
    setDetailError("");
    setTab("profile");
    setFiles([]);
    setSelectedFileIds([]);
    setFilePreview(undefined);
    setConversations([]);
    setSelectedConversationIds([]);
    setActiveConversation(undefined);
    setConversationDetailLoading(false);
    setMessages([]);
    void loadDetail();
  }, [loadDetail, userId]);

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/files?limit=100`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "文件列表加载失败");
      setFiles(data.files || []);
      setSelectedFileIds([]);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "文件列表加载失败");
    } finally {
      setFilesLoading(false);
    }
  }, [userId]);

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/conversations?limit=100`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "对话列表加载失败");
      setConversations(data.sessions || []);
      setSelectedConversationIds([]);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "对话列表加载失败");
    } finally {
      setConversationsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (tab === "files") void loadFiles();
    if (tab === "conversations") void loadConversations();
  }, [loadConversations, loadFiles, tab]);

  const patchUser = async (updates: Record<string, unknown>) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      toast.success("用户信息已更新");
      await loadDetail();
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (file: StoredFile, action: "download" | "preview") => {
    if (action === "preview") {
      setFilePreview(file);
      void fetch(`/api/admin/users/${userId}/files/${file.id}?action=preview`).catch(
        () => undefined,
      );
      return;
    }
    try {
      const response = await fetch(`/api/admin/users/${userId}/files/${file.id}?action=${action}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "文件访问失败");
      if (action === "download") {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : "文件访问失败");
    }
  };

  const openConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setMessages([]);
    setConversationDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/conversations/${conversation.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "对话加载失败");
      setMessages(data.messages || []);
    } catch (openError) {
      setActiveConversation(undefined);
      toast.error(openError instanceof Error ? openError.message : "对话加载失败");
    } finally {
      setConversationDetailLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const path =
        deleteTarget.kind === "user"
          ? `/api/admin/users/${userId}`
          : deleteTarget.kind === "file"
            ? `/api/admin/users/${userId}/files/${deleteTarget.id}`
            : deleteTarget.kind === "files"
              ? `/api/admin/users/${userId}/files`
              : deleteTarget.kind === "conversations"
                ? `/api/admin/users/${userId}/conversations`
                : `/api/admin/users/${userId}/conversations/${deleteTarget.id}`;
      const batchIds =
        deleteTarget.kind === "files"
          ? selectedFileIds
          : deleteTarget.kind === "conversations"
            ? selectedConversationIds
            : undefined;
      const response = await fetch(path, {
        body: batchIds ? JSON.stringify({ ids: batchIds }) : undefined,
        headers: batchIds ? { "Content-Type": "application/json" } : undefined,
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除失败");
      toast.success("已删除");
      setDeleteTarget(undefined);
      if (deleteTarget.kind === "user") onBack();
      if (deleteTarget.kind === "file" || deleteTarget.kind === "files") {
        setFilePreview(undefined);
        await loadFiles();
      }
      if (deleteTarget.kind === "conversation" || deleteTarget.kind === "conversations") {
        setActiveConversation(undefined);
        await loadConversations();
      }
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-[560px] sm:min-h-[680px]">
        {showHeader && (
          <div className="mb-5 flex min-h-14 items-center gap-3">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.07]"
              onClick={onBack}
              title="返回用户列表"
              type="button"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{detail?.user.email || "用户详情"}</p>
              <p className="text-xs text-gray-400">用户管理 / 详细信息</p>
            </div>
          </div>
        )}
        {detailError ? (
          <AdminError message={detailError} onRetry={() => void loadDetail()} />
        ) : !detail ? (
          <AdminLoading rows={8} />
        ) : (
          <div className="min-h-[520px] sm:min-h-[620px]">
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[430px] sm:min-w-0">
                <SegmentedControl
                  onChange={(value) => setTab(value as Tab)}
                  options={tabs}
                  padding={4}
                  value={tab}
                />
              </div>
            </div>
            <div className="mt-5 min-h-0 sm:mt-7">
              {tab === "profile" && (
                <ProfileEditor
                  detail={detail}
                  loading={loading}
                  onDelete={() =>
                    setDeleteTarget({ id: detail.user.id, kind: "user", label: detail.user.email })
                  }
                  onSave={patchUser}
                />
              )}
              {tab === "security" && (
                <SecurityPanel detail={detail} onChanged={loadDetail} userId={userId} />
              )}
              {tab === "files" && (
                <div>
                  <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <AdminCheckbox
                        checked={files.length > 0 && selectedFileIds.length === files.length}
                        indeterminate={
                          selectedFileIds.length > 0 && selectedFileIds.length < files.length
                        }
                        label="全选当前文件"
                        onChange={(checked) =>
                          setSelectedFileIds(checked ? files.map((file) => file.id) : [])
                        }
                      />
                      已选择 {selectedFileIds.length} 个文件
                    </div>
                    {selectedFileIds.length > 0 && (
                      <AdminButton
                        danger
                        onClick={() =>
                          setDeleteTarget({
                            id: "batch",
                            kind: "files",
                            label: `${selectedFileIds.length} 个文件`,
                          })
                        }
                      >
                        <Trash2 size={14} /> 批量删除
                      </AdminButton>
                    )}
                  </div>
                  {filesLoading ? (
                    <AdminLoading rows={7} />
                  ) : (
                    <div className="space-y-0.5">
                      {files.map((file, index) => (
                        <div
                          className={cn(
                            "grid grid-cols-[28px_minmax(0,1fr)_64px] items-center gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-100/80 sm:grid-cols-[28px_minmax(0,1fr)_110px_170px_92px] sm:gap-3 sm:px-3 dark:hover:bg-white/[0.06]",
                            index % 2 === 0 && "bg-gray-50/55 dark:bg-white/[0.018]",
                          )}
                          key={file.id}
                        >
                          <AdminCheckbox
                            checked={selectedFileIds.includes(file.id)}
                            label={`选择文件 ${file.originalName}`}
                            onChange={(checked) =>
                              setSelectedFileIds((current) =>
                                checked
                                  ? [...current, file.id]
                                  : current.filter((id) => id !== file.id),
                              )
                            }
                          />
                          <button
                            className="flex min-w-0 items-center gap-2 text-left"
                            onClick={() => void openFile(file, "preview")}
                            type="button"
                          >
                            <FileText className="shrink-0 text-gray-400" size={17} />
                            <span className="truncate text-sm font-medium">
                              {file.originalName}
                            </span>
                          </button>
                          <span className="hidden truncate text-xs text-gray-400 sm:block">
                            {file.contentType}
                          </span>
                          <span className="hidden text-xs text-gray-400 sm:block">
                            {formatDateTime(file.createdAt)}
                          </span>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.07]"
                              onClick={() => void openFile(file, "download")}
                              title={`下载 · ${formatBytes(file.size)}`}
                              type="button"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              onClick={() =>
                                setDeleteTarget({
                                  id: file.id,
                                  kind: "file",
                                  label: file.originalName,
                                })
                              }
                              title="删除"
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {!files.length && (
                        <p className="py-16 text-center text-sm text-gray-400">
                          该用户没有上传文件
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {tab === "conversations" && (
                <div>
                  <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <AdminCheckbox
                        checked={
                          conversations.length > 0 &&
                          selectedConversationIds.length === conversations.length
                        }
                        indeterminate={
                          selectedConversationIds.length > 0 &&
                          selectedConversationIds.length < conversations.length
                        }
                        label="全选当前对话"
                        onChange={(checked) =>
                          setSelectedConversationIds(
                            checked ? conversations.map((conversation) => conversation.id) : [],
                          )
                        }
                      />
                      已选择 {selectedConversationIds.length} 个对话
                    </div>
                    {selectedConversationIds.length > 0 && (
                      <AdminButton
                        danger
                        onClick={() =>
                          setDeleteTarget({
                            id: "batch",
                            kind: "conversations",
                            label: `${selectedConversationIds.length} 个对话`,
                          })
                        }
                      >
                        <Trash2 size={14} /> 批量删除
                      </AdminButton>
                    )}
                  </div>
                  {conversationsLoading ? (
                    <AdminLoading rows={7} />
                  ) : (
                    <div className="space-y-0.5">
                      {conversations.map((conversation, index) => (
                        <div
                          className={cn(
                            "grid grid-cols-[28px_minmax(0,1fr)_42px] items-center gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-gray-100/80 sm:grid-cols-[28px_minmax(0,1fr)_140px_170px] sm:gap-3 sm:px-3 dark:hover:bg-white/[0.06]",
                            index % 2 === 0 && "bg-gray-50/55 dark:bg-white/[0.018]",
                          )}
                          key={conversation.id}
                        >
                          <AdminCheckbox
                            checked={selectedConversationIds.includes(conversation.id)}
                            label={`选择对话 ${conversation.title}`}
                            onChange={(checked) =>
                              setSelectedConversationIds((current) =>
                                checked
                                  ? [...current, conversation.id]
                                  : current.filter((id) => id !== conversation.id),
                              )
                            }
                          />
                          <button
                            className="min-w-0 text-left"
                            onClick={() => void openConversation(conversation)}
                            type="button"
                          >
                            <p className="truncate text-sm font-medium">{conversation.title}</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {conversation.provider || "未知服务商"} ·{" "}
                              {conversation.model || "未知模型"}
                            </p>
                          </button>
                          <span className="hidden text-xs text-gray-400 sm:block">
                            {formatDateTime(conversation.updatedAt)}
                          </span>
                          <div className="flex justify-end">
                            <button
                              aria-label={`查看对话 ${conversation.title}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 sm:hidden dark:hover:bg-white/[0.07]"
                              onClick={() => void openConversation(conversation)}
                              type="button"
                            >
                              <Eye size={15} />
                            </button>
                            <span className="hidden sm:block">
                              <AdminButton onClick={() => void openConversation(conversation)}>
                                查看对话
                              </AdminButton>
                            </span>
                          </div>
                        </div>
                      ))}
                      {!conversations.length && (
                        <p className="py-16 text-center text-sm text-gray-400">暂无对话</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <FilePreviewDialog
        downloadUrl={
          filePreview
            ? `/api/admin/users/${userId}/files/${filePreview.id}?action=download-content`
            : undefined
        }
        file={
          filePreview
            ? {
                contentType: filePreview.contentType,
                id: filePreview.id,
                name: filePreview.originalName,
                size: filePreview.size,
              }
            : null
        }
        onClose={() => setFilePreview(undefined)}
        previewUrl={
          filePreview
            ? `/api/admin/users/${userId}/files/${filePreview.id}?action=content`
            : undefined
        }
      />
      <AppDialog
        bodyClassName="min-h-0 overflow-y-auto"
        height="min(88dvh, 880px)"
        onClose={() => {
          setActiveConversation(undefined);
          setMessages([]);
        }}
        open={!!activeConversation}
        panelClassName="overflow-hidden"
        title={activeConversation?.title || "对话预览"}
        width="min(94vw, 1080px)"
        zIndex={95}
      >
        <div className="min-h-full px-3 py-4 sm:px-5 md:px-8 md:py-6">
          {conversationDetailLoading ? (
            <div className="flex min-h-[520px] items-center justify-center text-gray-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : activeConversation ? (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs text-gray-400">
                    {activeConversation.provider || "未知服务商"} ·{" "}
                    {activeConversation.model || "未知模型"} · {messages.length} 条消息
                  </p>
                </div>
                <AdminButton
                  danger
                  onClick={() =>
                    setDeleteTarget({
                      id: activeConversation.id,
                      kind: "conversation",
                      label: activeConversation.title,
                    })
                  }
                >
                  <Trash2 size={14} /> 删除对话
                </AdminButton>
              </div>
              <div className="mx-auto max-w-4xl space-y-2">
                {messages.map((message) => (
                  <div
                    className="flex items-start gap-2.5 py-3 text-sm leading-6 sm:gap-3"
                    key={message.id}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        message.role === "user"
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-100 text-gray-500 dark:bg-white/[0.07]",
                      )}
                    >
                      {message.role === "user" ? (
                        <UserRound size={14} />
                      ) : (
                        <MessageSquareText size={14} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs font-medium text-gray-400">
                        {message.role === "user" ? "用户" : "模型"}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </AppDialog>
      <ConfirmDialog
        description={
          deleteTarget?.kind === "user"
            ? `将永久删除“${deleteTarget.label}”的账户、登录会话、全部聊天与消息、用户设置、模型配置，以及对象存储中的全部上传文件。此操作不可撤销。`
            : `“${deleteTarget?.label || ""}”将被永久删除，此操作会写入审计日志。`
        }
        loading={loading}
        onCancel={() => setDeleteTarget(undefined)}
        onConfirm={() => void confirmDelete()}
        open={!!deleteTarget}
        title={deleteTarget?.kind === "user" ? "删除用户及全部数据？" : "确认删除？"}
      />
    </>
  );
}

export function UserManagementDrawer({
  onChanged,
  onClose,
  open,
  userId,
}: {
  onChanged: () => void;
  onClose: () => void;
  open: boolean;
  userId?: string;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && userId && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] bg-black/25"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.section
            animate={{ y: 0 }}
            aria-label="用户详情"
            aria-modal="true"
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[#f8f8f8] text-gray-950 shadow-[0_-24px_80px_rgba(0,0,0,0.18)] dark:bg-[#0e0f11] dark:text-gray-50"
            exit={{ y: "100%" }}
            initial={{ y: "100%" }}
            role="dialog"
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="relative shrink-0 border-b border-gray-200/80 bg-white/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111214]/90 sm:px-6 sm:pt-0">
              <div className="mx-auto flex h-16 max-w-7xl items-center pr-11 sm:h-[72px]">
                <div>
                  <h2 className="text-base font-semibold sm:text-lg">用户详情</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    管理账户资料、安全、文件与对话
                  </p>
                </div>
              </div>
              <button
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.08] sm:right-5 sm:h-10 sm:w-10"
                onClick={onClose}
                title="关闭用户详情"
                type="button"
              >
                <X size={19} />
              </button>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto min-h-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
                <UserManagementView
                  onBack={onClose}
                  onChanged={onChanged}
                  showHeader={false}
                  userId={userId}
                />
              </div>
            </main>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ProfileEditor({
  detail,
  loading,
  onDelete,
  onSave,
}: {
  detail: UserDetail;
  loading: boolean;
  onDelete: () => void;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    age: detail.user.age?.toString() || "",
    banReason: detail.user.banReason || "",
    banned: !!detail.user.banned,
    email: detail.user.email,
    fullName: detail.user.fullName || "",
    role: detail.user.role || "user",
    username: detail.user.username || "",
  });
  return (
    <form
      className="max-w-4xl space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ ...form, age: form.age ? Number(form.age) : null });
      }}
    >
      <div>
        <h3 className="text-base font-semibold">基本资料</h3>
        <p className="mt-1 text-sm text-gray-400">修改用户公开资料与账户属性</p>
      </div>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        {[
          ["fullName", "昵称"],
          ["username", "用户名"],
          ["email", "邮箱"],
          ["age", "年龄"],
        ].map(([key, label]) => (
          <label className="text-sm font-medium" key={key}>
            {label}
            <input
              className={`${adminInputClass} mt-2`}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              value={form[key as keyof typeof form] as string}
            />
          </label>
        ))}
        <label className="text-sm font-medium">
          角色
          <AppSelect
            onChange={(value) =>
              typeof value === "string" && setForm((current) => ({ ...current, role: value }))
            }
            options={[
              { label: "普通用户", value: "user" },
              { label: "管理员", value: "admin" },
            ]}
            style={{ marginTop: 8, width: "100%" }}
            value={form.role}
          />
        </label>
        <label className="text-sm font-medium">
          账户状态
          <AppSelect
            onChange={(value) =>
              typeof value === "string" &&
              setForm((current) => ({ ...current, banned: value === "banned" }))
            }
            options={[
              { label: "正常", value: "active" },
              { label: "封禁", value: "banned" },
            ]}
            style={{ marginTop: 8, width: "100%" }}
            value={form.banned ? "banned" : "active"}
          />
        </label>
      </div>
      {form.banned && (
        <label className="block text-sm font-medium">
          封禁原因
          <textarea
            className="mt-2 min-h-20 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-[var(--chat-input-bg)]"
            onChange={(event) =>
              setForm((current) => ({ ...current, banReason: event.target.value }))
            }
            value={form.banReason}
          />
        </label>
      )}
      <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center sm:justify-between">
        <AdminButton danger onClick={onDelete}>
          <Trash2 size={14} /> 删除用户
        </AdminButton>
        <AdminButton loading={loading} primary type="submit">
          <Save size={14} /> 保存修改
        </AdminButton>
      </div>
    </form>
  );
}

function SecurityPanel({
  detail,
  onChanged,
  userId,
}: {
  detail: UserDetail;
  onChanged: () => Promise<void>;
  userId: string;
}) {
  const revoke = async (sessionId: string) => {
    const response = await fetch(`/api/admin/users/${userId}/login-sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (!response.ok) return toast.error("撤销会话失败");
    toast.success("登录会话已撤销");
    await onChanged();
  };
  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h3 className="font-semibold">登录方式</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.accounts.map((account) => (
            <StatusBadge
              key={`${account.providerId}-${account.createdAt}`}
              label={account.providerId}
              status="approved"
            />
          ))}
          {!detail.accounts.length && <span className="text-sm text-gray-400">暂无关联账户</span>}
        </div>
      </div>
      <div>
        <h3 className="font-semibold">活跃登录会话</h3>
        <div className="mt-3 space-y-0.5">
          {detail.loginSessions.map((session, index) => (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-2 py-3 transition-colors hover:bg-gray-100/80 sm:items-center sm:gap-3 dark:hover:bg-white/[0.06]",
                index % 2 === 0 && "bg-gray-50/55 dark:bg-white/[0.018]",
              )}
              key={session.id}
            >
              <Shield className="text-gray-400" size={18} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{session.userAgent || "未知设备"}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {session.ipAddress || "未知 IP"} · {formatDateTime(session.updatedAt)}
                </p>
              </div>
              <span className="shrink-0">
                <AdminButton danger onClick={() => void revoke(session.id)}>
                  撤销
                </AdminButton>
              </span>
            </div>
          ))}
          {!detail.loginSessions.length && (
            <p className="py-8 text-center text-sm text-gray-400">暂无活跃登录会话</p>
          )}
        </div>
      </div>
    </div>
  );
}
