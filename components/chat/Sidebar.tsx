"use client";

import { LoaderCircle, LogIn, PanelLeftClose, Plus, Puzzle, Search } from "lucide-react";
import Image from "next/image";
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
  { key: "week", label: "近 7 天" },
  { key: "month", label: "近 30 天" },
  { key: "earlier", label: "更早" },
];

function SessionSkeletonList() {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="flex h-9 items-center gap-2 rounded-lg px-1 py-1.5" key={index}>
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/80" />
          <div className="h-4 flex-1 animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/70" />
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
          <div className="mb-2 flex items-center justify-between p-3">
            <div className="ml-2 mt-1 flex items-center gap-3">
              <Image alt="MarkAI" height={32} priority src="/images/markai.svg" width={32} />
              <div>
                <h1 className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
                  MarkAI
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                onClick={() => useUIStore.getState().setSessionSearchOpen(true)}
                shape="rounded"
                size="sm"
                title="搜索会话"
              >
                <Search size={17} />
              </IconButton>
              <IconButton onClick={onClose} shape="rounded" size="sm" title="收起侧栏">
                <PanelLeftClose size={18} />
              </IconButton>
            </div>
          </div>

          <div className="mb-6 mt-2 px-4">
            <button
              className="group flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#f3f4f5] dark:bg-gray-800 px-3 text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors hover:bg-[#eceef0] dark:hover:bg-gray-700"
              onClick={onNewChat}
              type="button"
            >
              <Plus size={20} />
              <span>开启新话题</span>
            </button>

          </div>

          <div className="mb-4 px-3">
            <div className="mb-2 px-3 font-jakarta text-xs font-semibold uppercase tracking-wider text-gray-400">
              视图
            </div>
            <nav className="flex flex-col gap-1">
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
            <div className="mb-2 mt-4 px-3 font-jakarta text-xs font-semibold uppercase tracking-wider text-gray-400">
              历史
            </div>
            <div className="flex flex-col gap-1">
              {guest && (
                <div className="px-3 py-2 text-sm leading-6 text-gray-400">
                  登录后可查看和同步历史对话
                </div>
              )}
              {!guest && isLoadingSessions && <SessionSkeletonList />}
              {!guest && !isLoadingSessions && sessions.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">暂无历史对话</div>
              )}
              {groupedSessions.map((group) => {
                const collapsed = collapsedGroups.includes(group.key);
                return (
                  <div className="flex flex-col gap-1" key={group.key}>
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
              <button
                className="flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-black/[0.045] dark:hover:bg-white/[0.07]"
                onClick={onSignIn}
                type="button"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200/80 text-gray-500 dark:bg-white/[0.08] dark:text-gray-300">
                  <LogIn size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    登录 / 注册
                  </span>
                  <span className="block truncate text-xs text-gray-400">
                    同步会话、文件与个性化设置
                  </span>
                </span>
              </button>
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
