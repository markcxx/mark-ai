'use client';

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Hash,
  HelpCircle,
  MoreHorizontal,
  PanelLeftClose,
  PencilLine,
  Plus,
  Puzzle,
  Settings,
  Star,
  Trash2,
  Wand2,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { NOT_IMPLEMENTED_TOAST } from '@/lib/chat/constants';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineTextEdit } from '@/components/ui/InlineTextEdit';
import type { ChatSession } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

const getSessionTimeGroup = (updatedAt: number) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;

  if (updatedAt >= todayStart) return 'today';
  if (updatedAt >= todayStart - day) return 'yesterday';
  if (updatedAt >= todayStart - 7 * day) return 'week';
  if (updatedAt >= todayStart - 30 * day) return 'month';
  return 'earlier';
};

const SESSION_GROUPS = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'week', label: '近 7 天' },
  { key: 'month', label: '近 30 天' },
  { key: 'earlier', label: '更早' },
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
  isOpen,
  isResizing,
  isLoadingSessions,
  loadingSessionIds,
  onClose,
  onDeleteSession,
  onNewChat,
  onRenameSession,
  onSelectSession,
  onToggleFavorite,
  onUpdateSessionTitle,
  onUnavailable,
  sessions,
  width,
}: {
  activeSessionId: string | null;
  isOpen: boolean;
  isResizing: boolean;
  isLoadingSessions: boolean;
  loadingSessionIds: string[];
  onClose: () => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  onRenameSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onToggleFavorite: (sessionId: string, favorite: boolean) => void;
  onUpdateSessionTitle: (sessionId: string, title: string) => void;
  onUnavailable: (message?: string) => void;
  sessions: ChatSession[];
  width: number;
}) {
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
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

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openSessionMenuId]);

  return (
    <aside
      className={cn(
        'z-30 flex h-full shrink-0 flex-col bg-[#f8f8f8] dark:bg-[#000000]',
        !isResizing && 'transition-[width,margin] duration-200 ease-out',
        isOpen ? 'mr-2' : 'mr-0 w-0 overflow-hidden',
      )}
      style={isOpen ? { width } : undefined}
    >
      <div className="flex h-full flex-col" style={{ width }}>
        <div className="mb-2 flex items-center justify-between p-3">
          <div className="ml-2 mt-1 flex items-center gap-3">
            <Image
              alt="MarkAI"
              className="h-8 w-8"
              height={32}
              priority
              src="/images/markai.svg"
              width={32}
            />
            <div>
              <h1 className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">MarkAI</h1>
            </div>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            onClick={onClose}
            title="收起侧栏"
            type="button"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="mb-6 mt-2 px-4">
          <button
            className="group flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#f3f4f5] dark:bg-gray-800 px-3 text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors hover:bg-[#eceef0] dark:hover:bg-gray-700"
            onClick={onNewChat}
            type="button"
          >
            <Plus size={20} />
            <span>新建会话</span>
            <span className="ml-auto text-xs text-gray-400 transition-colors group-hover:text-gray-500">
              ⌘K
            </span>
          </button>
        </div>

        <div className="mb-4 px-3">
          <div className="mb-2 px-3 font-jakarta text-xs font-semibold uppercase tracking-wider text-gray-400">
            视图
          </div>
          <nav className="flex flex-col gap-1">
            <button
              className="flex items-center gap-3 rounded-lg bg-gray-200 dark:bg-gray-800 px-3 py-2 font-medium text-gray-900 dark:text-gray-100 transition-colors"
              onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
              type="button"
            >
              <Puzzle size={20} />
              <span className="text-sm">插件中心</span>
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-2 mt-4 px-3 font-jakarta text-xs font-semibold uppercase tracking-wider text-gray-400">
            历史
          </div>
          <div className="flex flex-col gap-1">
            {isLoadingSessions && <SessionSkeletonList />}
            {!isLoadingSessions && sessions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">暂无历史对话</div>
            )}
            {groupedSessions.map((group) => {
              const collapsed = collapsedGroups.includes(group.key);
              return (
                <div className="flex flex-col gap-1" key={group.key}>
                  <button
                    className="mt-1 flex h-7 items-center gap-1 rounded-md px-2 text-left text-xs font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    onClick={() =>
                      setCollapsedGroups((current) =>
                        current.includes(group.key)
                          ? current.filter((key) => key !== group.key)
                          : [...current, group.key],
                      )
                    }
                    type="button"
                  >
                    {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    <span>{group.label}</span>
                    <span className="ml-auto tabular-nums">{group.sessions.length}</span>
                  </button>

                  {!collapsed && group.sessions.map((session) => {
                    const active = activeSessionId === session.id;
                    const loading = loadingSessionIds.includes(session.id);
                    const menuOpen = openSessionMenuId === session.id;

                    return (
                      <div
                        className="relative"
                        key={session.id}
                        ref={menuOpen ? menuRef : undefined}
                      >
                        <div
                          className={cn(
                            'group flex h-9 min-w-0 items-center gap-2 overflow-hidden rounded-lg px-1 text-sm transition-colors',
                            active ? 'bg-[#eceef0] dark:bg-gray-800 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-[#f0f1f2] dark:hover:bg-gray-800/60',
                          )}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onSelectSession(session.id);
                            }
                          }}
                          onClick={() => onSelectSession(session.id)}
                          role="button"
                          tabIndex={0}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-400">
                            <Hash size={15} />
                          </span>
                          {editingSessionId === session.id ? (
                            <InlineTextEdit
                              className="h-7 min-w-0 flex-1 px-2 text-sm"
                              onCancel={() => setEditingSessionId(null)}
                              onChange={setEditingTitle}
                              onSave={() => {
                                const nextTitle = editingTitle.trim();
                                setEditingSessionId(null);
                                if (nextTitle && nextTitle !== session.title) {
                                  onUpdateSessionTitle(session.id, nextTitle);
                                }
                              }}
                              value={editingTitle}
                            />
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-left">
                              {session.title || '新对话'}
                            </span>
                          )}
                          {session.favorite && (
                            <button
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-amber-400 transition-colors hover:bg-amber-100/70 hover:text-amber-500 dark:hover:bg-amber-400/10"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onToggleFavorite(session.id, false);
                              }}
                              title="取消收藏"
                              type="button"
                            >
                              <Star fill="currentColor" size={14} />
                            </button>
                          )}
                          {loading ? (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                            </span>
                          ) : (
                            <button
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 group-hover:opacity-100',
                                menuOpen && 'opacity-100',
                              )}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenSessionMenuId(menuOpen ? null : session.id);
                              }}
                              title="更多"
                              type="button"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          )}
                        </div>

                        {menuOpen && (
                    <div className="absolute right-1 top-8 z-50 min-w-36 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 text-sm shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                      <button
                        className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setOpenSessionMenuId(null);
                          onRenameSession(session.id);
                        }}
                        type="button"
                      >
                        <Wand2 size={14} />
                        <span>自动命名</span>
                      </button>
                      <button
                        className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setOpenSessionMenuId(null);
                          setEditingSessionId(session.id);
                          setEditingTitle(session.title || '新对话');
                        }}
                        type="button"
                      >
                        <PencilLine size={14} />
                        <span>重命名</span>
                      </button>
                      <button
                        className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setOpenSessionMenuId(null);
                          navigator.clipboard.writeText(session.id);
                        }}
                        type="button"
                      >
                        <Copy size={14} />
                        <span>复制 ID</span>
                      </button>
                      <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                      <button
                        className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          setOpenSessionMenuId(null);
                          setDeletingSession(session);
                        }}
                        type="button"
                      >
                        <Trash2 size={14} />
                        <span>删除</span>
                      </button>
                    </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-auto border-t border-gray-200/50 dark:border-gray-700/50 p-4">
          <nav className="flex flex-col gap-1">
            <button
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
              type="button"
            >
              <Settings size={20} />
              <span className="text-sm">设置</span>
            </button>
            <button
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
              type="button"
            >
              <HelpCircle size={20} />
              <span className="text-sm">帮助</span>
            </button>
          </nav>
        </div>
      </div>
      <ConfirmDialog
        confirmText="删除"
        description={`“${deletingSession?.title || '新对话'}” 会被永久删除，此操作无法撤销。`}
        onCancel={() => setDeletingSession(null)}
        onConfirm={() => {
          if (deletingSession) onDeleteSession(deletingSession.id);
          setDeletingSession(null);
        }}
        open={Boolean(deletingSession)}
        title="删除这个会话？"
      />
    </aside>
  );
}
