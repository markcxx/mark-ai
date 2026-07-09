'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Expand,
  MoreVertical,
  PanelLeftOpen,
  PencilLine,
  Share2,
  Shrink,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';

import { ThemeToggle } from '@/components/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DropdownSurface } from '@/components/ui/DropdownSurface';
import { IconButton } from '@/components/ui/IconButton';
import { InlineTextEdit } from '@/components/ui/InlineTextEdit';
import { MenuAction, MenuSwitchAction } from '@/components/ui/MenuAction';
import type { ChatSession } from '@/lib/chat/types';

export function TopHeader({
  activeSession,
  copyConversation,
  copySessionId,
  deleteSession,
  isFavorite,
  isSidebarOpen,
  isWideChatMode,
  onOpenSidebar,
  smartRenameSession,
  toggleFavorite,
  toggleWideChatMode,
  updateSessionTitle,
}: {
  activeSession?: ChatSession;
  copyConversation: () => void;
  copySessionId: () => void;
  deleteSession: () => void;
  isFavorite: boolean;
  isSidebarOpen: boolean;
  isWideChatMode: boolean;
  onOpenSidebar: () => void;
  smartRenameSession: () => void;
  toggleFavorite: () => void;
  toggleWideChatMode: () => void;
  updateSessionTitle: (title: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const title = activeSession?.title || '新对话';

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const beginRename = () => {
    setDraftTitle(title);
    setEditingTitle(true);
    setMenuOpen(false);
  };

  const saveTitle = () => {
    const nextTitle = draftTitle.trim();
    setEditingTitle(false);
    if (nextTitle && nextTitle !== title) updateSessionTitle(nextTitle);
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between bg-[var(--chat-header-bg)] px-6 backdrop-blur-md">
        <div className="flex min-w-0 items-center">
          {!isSidebarOpen && (
            <IconButton
              className="mr-2"
              onClick={onOpenSidebar}
              title="展开侧栏"
            >
              <PanelLeftOpen size={18} />
            </IconButton>
          )}

          <div className="relative flex min-w-0 items-center gap-1" ref={menuRef}>
            {editingTitle ? (
              <InlineTextEdit
                className="h-9 max-w-[52vw] text-base font-semibold"
                onCancel={() => setEditingTitle(false)}
                onChange={setDraftTitle}
                onSave={saveTitle}
                value={draftTitle}
              />
            ) : (
              <h2 className="max-w-[52vw] truncate px-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h2>
            )}

            <IconButton
              onClick={() => setMenuOpen((open) => !open)}
              size="sm"
              title="会话操作"
            >
              <MoreVertical size={17} />
            </IconButton>

            {menuOpen && (
              <DropdownSurface className="absolute left-0 top-11 w-56">
                <MenuAction
                  icon={Sparkles}
                  label="智能重命名"
                  onClick={() => {
                    setMenuOpen(false);
                    smartRenameSession();
                  }}
                />
                <MenuAction icon={PencilLine} label="重命名" onClick={beginRename} />
                <MenuAction
                  icon={Star}
                  label={isFavorite ? '取消收藏' : '收藏'}
                  onClick={() => {
                    setMenuOpen(false);
                    toggleFavorite();
                  }}
                />
                <MenuAction
                  icon={Copy}
                  label="复制会话 ID"
                  onClick={() => {
                    setMenuOpen(false);
                    copySessionId();
                  }}
                />

                <MenuSwitchAction
                  checked={isWideChatMode}
                  icon={isWideChatMode ? Shrink : Expand}
                  label="全宽显示"
                  onClick={toggleWideChatMode}
                />

                <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />
                <MenuAction
                  danger
                  icon={Trash2}
                  label="删除会话"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                />
              </DropdownSurface>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <IconButton onClick={copyConversation} title="复制对话">
            <Share2 size={20} />
          </IconButton>
        </div>
      </header>

      <ConfirmDialog
        confirmText="删除"
        description="该会话和其中的消息会被永久删除，此操作无法撤销。"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          deleteSession();
        }}
        open={deleteOpen}
        title="删除当前会话？"
      />
    </>
  );
}
