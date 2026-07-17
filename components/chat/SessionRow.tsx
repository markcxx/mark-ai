"use client";

import type { RefObject } from "react";
import { Copy, Hash, MoreHorizontal, PencilLine, Star, Trash2, Wand2 } from "lucide-react";

import { DropdownSurface } from "@/components/ui/DropdownSurface";
import { IconButton } from "@/components/ui/IconButton";
import { InlineTextEdit } from "@/components/ui/InlineTextEdit";
import { MenuAction } from "@/components/ui/MenuAction";
import type { ChatSession } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function SessionRow({
  active,
  editing,
  editingTitle,
  loading,
  menuOpen,
  menuRef,
  onAutoRename,
  onCancelEditing,
  onCopyId,
  onDelete,
  onEditingTitleChange,
  onSaveEditing,
  onSelect,
  onStartRename,
  onToggleFavorite,
  onToggleMenu,
  session,
}: {
  active: boolean;
  editing: boolean;
  editingTitle: string;
  loading: boolean;
  menuOpen: boolean;
  menuRef?: RefObject<HTMLDivElement | null>;
  onAutoRename: () => void;
  onCancelEditing: () => void;
  onCopyId: () => void;
  onDelete: () => void;
  onEditingTitleChange: (title: string) => void;
  onSaveEditing: () => void;
  onSelect: () => void;
  onStartRename: () => void;
  onToggleFavorite: () => void;
  onToggleMenu: () => void;
  session: ChatSession;
}) {
  return (
    <div className="relative" ref={menuOpen ? menuRef : undefined}>
      <div
        className={cn(
          "group flex h-9 min-w-0 items-center gap-2 overflow-hidden rounded-lg px-1 text-sm transition-colors",
          active
            ? "bg-[#eceef0] text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "text-gray-700 hover:bg-[#f0f1f2] dark:text-gray-300 dark:hover:bg-gray-800/60",
        )}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-400">
          <Hash size={15} />
        </span>

        {editing ? (
          <InlineTextEdit
            className="h-7 min-w-0 flex-1 px-2 text-sm"
            onCancel={onCancelEditing}
            onChange={onEditingTitleChange}
            onSave={onSaveEditing}
            value={editingTitle}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">{session.title || "新对话"}</span>
        )}

        {session.favorite && (
          <IconButton
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite();
            }}
            shape="rounded"
            size="xs"
            title="取消收藏"
            variant="favorite"
          >
            <Star fill="currentColor" size={14} />
          </IconButton>
        )}

        {loading ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
          </span>
        ) : (
          <IconButton
            className={cn(
              "opacity-0 transition-opacity group-hover:opacity-100",
              menuOpen && "opacity-100",
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleMenu();
            }}
            shape="rounded"
            size="xs"
            title="更多"
          >
            <MoreHorizontal size={15} />
          </IconButton>
        )}
      </div>

      {menuOpen && (
        <DropdownSurface className="absolute right-1 top-8 min-w-36 rounded-lg border-gray-200 bg-white py-1 text-sm shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:border-gray-700 dark:bg-gray-800">
          <MenuAction icon={Wand2} label="自动命名" onClick={onAutoRename} />
          <MenuAction icon={PencilLine} label="重命名" onClick={onStartRename} />
          <MenuAction icon={Copy} label="复制 ID" onClick={onCopyId} />
          <div className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
          <MenuAction danger icon={Trash2} label="删除" onClick={onDelete} />
        </DropdownSurface>
      )}
    </div>
  );
}
