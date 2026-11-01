"use client";

import {
  ChartNoAxesColumnIncreasing,
  LoaderCircle,
  History,
  MessageCirclePlus,
  PanelLeftClose,
  Puzzle,
  Search,
} from "lucide-react";
import Link from "next/link";
import Image from "@/components/ui/AppImage";
import { requestGuestRegister } from "@/lib/client/guest-mode";
import { useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import type { ChatSession } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import type { SessionGenerationStatus } from "@/stores/useSessionStore";

import { SessionGroupHeader } from "./SessionGroupHeader";
import { SidebarNavItem } from "./SidebarNavItem";
import { SessionRow } from "./SessionRow";
import { UserAccountMenu } from "./UserAccountMenu";

const getSessionTimeGroup = (updatedAt: number) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;

  if (updatedAt >= todayStart) return "today";
  if (updatedAt >= todayStart - day) return "yesterday";
  if (updatedAt >= todayStart - 7 * day) return "week";
  if (updatedAt >= todayStart - 30 * day) return "month";
  return "earlier";
};

const SESSION_GROUPS = [
  { key: "today", label: "今天" },
  { key: "yesterday", label: "昨天" },
  { key: "week", label: "7 天内" },
  { key: "month", label: "30 天内" },
  { key: "earlier", label: "更早" },
];

function SessionSkeletonList() {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="flex h-11 items-center rounded-lg px-3 md:h-10" key={index}>
          <div className="h-4 w-3/4 animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/70" />
        </div>
      ))}
    </div>
  );
}

export function Sidebar({
  activeSessionId,
  guest = false,
  onSignIn,
  isOpen,
  isResizing,
  isLoadingSessions,
  isLoadingMoreSessions,
  generationStatusBySessionId,
  loadingSessionIds,
  onClose,
  onDeleteSession,
  onNewChat,
  onLoadMoreSessions,
  onRenameSession,
  onSelectSession,
  onToggleFavorite,
  onUpdateSessionTitle,
  sessions,
  hasMoreSessions,
  width,
}: {
  activeSessionId: string | null;
  guest?: boolean;
  onSignIn?: () => void;
  hasMoreSessions: boolean;
  isOpen: boolean;
  isResizing: boolean;
  isLoadingSessions: boolean;
  isLoadingMoreSessions: boolean;
  generationStatusBySessionId: Record<string, SessionGenerationStatus>;
  loadingSessionIds: string[];
  onClose: () => void;
  onDeleteSession: (sessionId: string) => void;
  onLoadMoreSessions: () => void;
  onNewChat: () => void;
  onRenameSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onToggleFavorite: (sessionId: string, favorite: boolean) => void;
  onUpdateSessionTitle: (sessionId: string, title: string) => void;
  sessions: ChatSession[];
  width: number;
}) {
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSession, setDeletingSession] = useState<ChatSession | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const groupedSessions = SESSION_GROUPS.map((group) => ({
    ...group,
    sessions: sessions.filter((session) => getSessionTimeGroup(session.updatedAt) === group.key),
  })).filter((group) => group.sessions.length > 0);

  useEffect(() => {
    if (!openSessionMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpenSessionMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openSessionMenuId]);

  const renderSessionRow = (session: ChatSession) => {
    const active = activeSessionId === session.id;
    const loading = loadingSessionIds.includes(session.id);
    const menuOpen = openSessionMenuId === session.id;
    const editing = editingSessionId === session.id;

    return (
      <SessionRow
        active={active}
        editing={editing}
        editingTitle={editingTitle}
        generationStatus={generationStatusBySessionId[session.id]}
        key={session.id}
        loading={loading}
        menuOpen={menuOpen}
        menuRef={menuRef}
        onAutoRename={() => {
          setOpenSessionMenuId(null);
          onRenameSession(session.id);
        }}
        onCancelEditing={() => setEditingSessionId(null)}
        onCopyId={() => {
          setOpenSessionMenuId(null);
          navigator.clipboard.writeText(session.id);
        }}
        onDelete={() => {
          setOpenSessionMenuId(null);
          setDeletingSession(session);
        }}
        onEditingTitleChange={setEditingTitle}
        onSaveEditing={() => {
          const nextTitle = editingTitle.trim();
          setEditingSessionId(null);
          if (nextTitle && nextTitle !== session.title) onUpdateSessionTitle(session.id, nextTitle);
        }}
        onSelect={() => onSelectSession(session.id)}
        onStartRename={() => {
          setOpenSessionMenuId(null);
          setEditingSessionId(session.id);
          setEditingTitle(session.title || "新对话");
        }}
        onToggleFavorite={() => onToggleFavorite(session.id, !session.favorite)}
        onToggleMenu={() => setOpenSessionMenuId(menuOpen ? null : session.id)}
        session={session}
      />
    );
  };

  return (
    <>
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex h-full max-w-[86vw] shrink-0 flex-col bg-[#f8f8f8] shadow-[16px_0_40px_rgba(15,23,42,0.16)] will-change-transform dark:bg-[#000000] md:static md:z-30 md:h-full md:max-w-none md:shadow-none md:will-change-auto",
          !isResizing &&
            "transition-[width,margin,transform,opacity,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:duration-200",
          isOpen
            ? "translate-x-0 opacity-100 md:mr-2"
            : "-translate-x-[calc(100%+24px)] opacity-0 md:mr-0 md:w-0 md:translate-x-0 md:overflow-hidden md:opacity-100",
        )}
        style={isOpen ? { width } : undefined}
      >
        <div className="flex h-full w-full flex-col">
          <div className="mb-2 flex items-center justify-between gap-2 px-4 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Image alt="MarkAI" height={32} priority src="/images/markai.svg" width={32} />
              <div className="min-w-0">
                <h1 className="truncate font-jakarta text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
                  MarkAI
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                onClick={() => useUIStore.getState().setSessionSearchOpen(true)}
                shape="rounded"
                size="sm"
                aria-label="搜索会话"
                data-markai-tooltip="搜索会话"
              >
                <Search size={17} />
              </IconButton>
              <IconButton
                onClick={onClose}
                shape="rounded"
                size="sm"
                aria-label="收起侧栏"
                data-markai-tooltip="收起侧栏"
              >
                <PanelLeftClose size={18} />
              </IconButton>
            </div>
          </div>

          <div className="mb-4 px-3">
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200/60 bg-white px-3 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#191919] dark:text-gray-100 dark:hover:bg-white/[0.1]"
              onClick={onNewChat}
              type="button"
            >
              <MessageCirclePlus size={19} />
              <span>开启新对话</span>
            </button>
          </div>

          <div className="mb-2 px-3">
            <nav className="flex flex-col gap-1">
              <Link
                href="/rankings"
                className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm text-gray-700 hover:bg-[#f0f1f2] dark:text-gray-300 dark:hover:bg-gray-800/60 md:min-h-9"
              >
                <span className="flex h-7 w-7 items-center justify-center text-gray-400">
                  <ChartNoAxesColumnIncreasing size={15} />
                </span>
                模型排名
              </Link>
              <SidebarNavItem
                icon={Puzzle}
                label="插件中心"
                onClick={() => useUIStore.getState().setPluginCenterOpen(true)}
              />
            </nav>
          </div>

          <div
            className="markai-scrollbar-auto-hide flex-1 overflow-y-auto px-3 pb-4"
            onScroll={(event) => {
              const target = event.currentTarget;
              if (target.scrollHeight - target.scrollTop - target.clientHeight > 160) return;
              if (hasMoreSessions && !isLoadingMoreSessions) {
                onLoadMoreSessions();
              }
            }}
          >
            <div className="flex flex-col gap-4 pt-2">
              {guest && (
                <div className="mx-3 rounded-xl border border-dashed border-gray-200 px-3 py-3 dark:border-white/10">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
                    <History className="text-gray-400" size={14} />
                    历史对话
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-400">
                    登录后自动保存每一次对话，并在网页和手机端同步。
                  </p>
                </div>
              )}
              {!guest && isLoadingSessions && <SessionSkeletonList />}
              {!guest && !isLoadingSessions && sessions.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">暂无历史对话</div>
              )}
              {groupedSessions.map((group) => {
                const collapsed = collapsedGroups.includes(group.key);
                return (
                  <div className="flex flex-col gap-0.5" key={group.key}>
                    <SessionGroupHeader
                      collapsed={collapsed}
                      count={group.sessions.length}
                      label={group.label}
                      onToggle={() =>
                        setCollapsedGroups((current) =>
                          current.includes(group.key)
                            ? current.filter((key) => key !== group.key)
                            : [...current, group.key],
                        )
                      }
                    />

                    {!collapsed && group.sessions.map(renderSessionRow)}
                  </div>
                );
              })}
              {isLoadingMoreSessions && (
                <div className="flex h-10 items-center justify-center text-gray-400">
                  <LoaderCircle className="animate-spin" size={16} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto border-t border-gray-200/50 p-3 dark:border-gray-700/50">
            {guest ? (
              <div className="rounded-xl border border-gray-200/80 bg-[var(--chat-panel-bg)] p-3 dark:border-white/[0.08]">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  开始使用 MarkAI
                </p>
                <p className="mt-0.5 text-xs leading-5 text-gray-400">
                  免费注册即可对话，同步会话、文件与设置
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="min-h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 md:min-h-9 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/[0.05]"
                    onClick={onSignIn}
                    type="button"
                  >
                    登录
                  </button>
                  <button
                    className="flex min-h-10 items-center justify-center rounded-lg bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-700 md:min-h-9 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    onClick={requestGuestRegister}
                    type="button"
                  >
                    注册
                  </button>
                </div>
              </div>
            ) : (
              <UserAccountMenu />
            )}
          </div>
        </div>
        <ConfirmDialog
          confirmText="删除"
          description={`“${deletingSession?.title || "新对话"}” 会被永久删除，此操作无法撤销。`}
          onCancel={() => setDeletingSession(null)}
          onConfirm={() => {
            if (deletingSession) onDeleteSession(deletingSession.id);
            setDeletingSession(null);
          }}
          open={Boolean(deletingSession)}
          title="删除这个会话？"
        />
      </aside>
    </>
  );
}
