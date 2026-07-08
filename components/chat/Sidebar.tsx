'use client';

import {
  Copy,
  Hash,
  HelpCircle,
  MoreHorizontal,
  PanelLeftClose,
  PencilLine,
  Plus,
  Puzzle,
  Settings,
  Trash2,
  Wand2,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { NOT_IMPLEMENTED_TOAST } from '@/lib/chat/constants';
import type { ChatSession } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

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
  onUpdateSessionTitle: (sessionId: string, title: string) => void;
  onUnavailable: (message?: string) => void;
  sessions: ChatSession[];
  width: number;
}) {
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
        'z-30 flex h-full shrink-0 flex-col bg-[#f8f8f8] dark:bg-[#0e0f11]',
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
            {sessions.map((session) => {
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
                    <span className="min-w-0 flex-1 truncate text-left">
                      {session.title || '新对话'}
                    </span>
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
                          const nextTitle = window.prompt('重命名会话', session.title);
                          if (nextTitle?.trim()) {
                            onUpdateSessionTitle(session.id, nextTitle.trim());
                          }
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
                          if (window.confirm('确定删除这个会话吗？')) {
                            onDeleteSession(session.id);
                          }
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
    </aside>
  );
}
