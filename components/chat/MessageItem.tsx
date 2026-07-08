'use client';

import { RefObject, useMemo, useRef } from 'react';
import {
  CheckSquare,
  Copy,
  Languages,
  MessageSquarePlus,
  Minimize2,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Share2,
  Trash2,
  Volume2,
} from 'lucide-react';

import type { ConfiguredModel, MenuItem, Message } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

import { CollapsibleContent } from './CollapsibleContent';
import { FloatingMenu } from './FloatingMenu';
import { MarkdownContent } from './MarkdownContent';
import { MessageSelectionWrapper } from './MessageSelectionWrapper';
import { ModelAvatar } from './ModelAvatar';
import { ThinkingPanel } from './ThinkingPanel';

function MoreMenuButton({
  align,
  items,
  menuId,
  openMenuId,
  setOpenMenuId,
}: {
  align: 'left' | 'right';
  items: MenuItem[];
  menuId: string;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const open = openMenuId === menuId;

  return (
    <>
      <button
        className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
        onClick={() => setOpenMenuId(open ? null : menuId)}
        ref={buttonRef}
        title="更多"
        type="button"
      >
        <MoreHorizontal size={15} />
      </button>
      <FloatingMenu
        align={align}
        anchorRef={buttonRef as RefObject<HTMLElement | null>}
        items={items}
        onClose={() => setOpenMenuId(null)}
        open={open}
      />
    </>
  );
}

export function MessageItem({
  cancelEditingMessage,
  collapsed,
  copyMessage,
  deleteMessage,
  editingContent,
  editingMessageId,
  enableMultiSelect,
  getMessageModel,
  isSelected,
  loadingText,
  menuUnavailable,
  message,
  multiSelectMode,
  openMenuMessageId,
  regenerateMessage,
  saveEditingMessage,
  selectedModel,
  setEditingContent,
  setOpenMenuMessageId,
  startEditingMessage,
  toggleCollapseMessage,
  toggleSelectedMessage,
}: {
  cancelEditingMessage: () => void;
  collapsed: boolean;
  copyMessage: (message: Message) => void;
  deleteMessage: (id: string) => void;
  editingContent: string;
  editingMessageId: string | null;
  enableMultiSelect: (id: string) => void;
  getMessageModel: (message: Message) => ConfiguredModel | undefined;
  isSelected: boolean;
  loadingText: string;
  menuUnavailable: () => void;
  message: Message;
  multiSelectMode: boolean;
  openMenuMessageId: string | null;
  regenerateMessage: (message: Message, deleteCurrent?: boolean) => Promise<void>;
  saveEditingMessage: () => void;
  selectedModel?: ConfiguredModel;
  setEditingContent: (content: string) => void;
  setOpenMenuMessageId: (id: string | null) => void;
  startEditingMessage: (message: Message) => void;
  toggleCollapseMessage: (id: string) => void;
  toggleSelectedMessage: (id: string, shiftKey?: boolean) => void;
}) {
  const moreItems = useMemo<MenuItem[]>(
    () => [
      { icon: Pencil, label: '编辑', onClick: () => startEditingMessage(message) },
      { icon: Copy, label: '复制', onClick: () => copyMessage(message) },
      { icon: MessageSquarePlus, label: '创建子话题', onClick: menuUnavailable },
      {
        icon: Minimize2,
        label: collapsed ? '展开消息' : '收起消息',
        onClick: () => toggleCollapseMessage(message.id),
      },
      { icon: Volume2, label: '语音朗读', onClick: menuUnavailable },
      { icon: Languages, label: '翻译', onClick: menuUnavailable },
      { icon: Share2, label: '分享', onClick: menuUnavailable },
      { icon: CheckSquare, label: '多选', onClick: () => enableMultiSelect(message.id) },
      { icon: RotateCw, label: '重新生成', onClick: () => regenerateMessage(message) },
      {
        danger: true,
        icon: RotateCw,
        label: '删除并重新生成',
        onClick: () => regenerateMessage(message, true),
      },
      { danger: true, icon: Trash2, label: '删除', onClick: () => deleteMessage(message.id) },
    ],
    [
      collapsed,
      copyMessage,
      deleteMessage,
      enableMultiSelect,
      menuUnavailable,
      message,
      regenerateMessage,
      startEditingMessage,
      toggleCollapseMessage,
    ],
  );

  const editing = editingMessageId === message.id;
  const body = message.role === 'user' ? (
    <div className="group relative flex w-full flex-col items-end">
      {editing ? (
        <div className="w-full max-w-[85%] rounded-2xl rounded-tr-sm bg-[#f3f4f5] dark:bg-gray-800 p-3 shadow-sm">
          <textarea
            autoFocus
            className="min-h-[96px] w-full resize-y rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-[15px] text-gray-900 dark:text-gray-100 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            onChange={(event) => setEditingContent(event.target.value)}
            value={editingContent}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={cancelEditingMessage}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm text-white dark:text-gray-900 transition-opacity hover:opacity-85"
              onClick={saveEditingMessage}
              type="button"
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <div
          className="w-fit max-w-[85%] break-words rounded-2xl rounded-tr-sm bg-[#f3f4f5] dark:bg-gray-800 px-5 py-3 text-left text-[15px] text-gray-900 dark:text-gray-100 shadow-sm whitespace-pre-wrap"
        >
          <CollapsibleContent>{collapsed ? '消息已收起' : message.content}</CollapsibleContent>
        </div>
      )}
      {!multiSelectMode && (
        <div className="mr-1 mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            onClick={() => startEditingMessage(message)}
            title="编辑"
            type="button"
          >
            <Pencil size={15} />
          </button>
          <button
            className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            onClick={() => copyMessage(message)}
            title="复制"
            type="button"
          >
            <Copy size={15} />
          </button>
          <button
            className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
            onClick={() => deleteMessage(message.id)}
            title="删除"
            type="button"
          >
            <Trash2 size={15} />
          </button>
          <MoreMenuButton
            align="right"
            items={moreItems}
            menuId={message.id}
            openMenuId={openMenuMessageId}
            setOpenMenuId={setOpenMenuMessageId}
          />
        </div>
      )}
    </div>
  ) : (
    <div className="group relative w-full">
      <div className="message-header mb-3 flex items-center gap-2.5">
        <ModelAvatar model={message.model} provider={message.provider} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-jakarta text-[15px] font-bold text-gray-900 dark:text-gray-100">
            {message.model || selectedModel?.id}
          </span>
          {message.isStreaming && (
            <span className="mt-0.5 animate-pulse text-xs font-medium text-gray-400">
              {loadingText}
            </span>
          )}
        </div>
      </div>

      <div className="markdown-body ml-10 text-[15px] leading-relaxed text-gray-900 dark:text-gray-100">
        {editing ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
            <textarea
              autoFocus
              className="min-h-[180px] w-full resize-y rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-[15px] text-gray-900 dark:text-gray-100 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setEditingContent(event.target.value)}
              value={editingContent}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={cancelEditingMessage}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm text-white dark:text-gray-900 transition-opacity hover:opacity-85"
                onClick={saveEditingMessage}
                type="button"
              >
                保存
              </button>
            </div>
          </div>
        ) : collapsed ? (
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            消息已收起
          </div>
        ) : (
          <>
            <ThinkingPanel
              content={message.reasoning}
              duration={message.reasoningDuration}
              thinking={message.isReasoning}
            />
            {message.content ? <MarkdownContent>{message.content}</MarkdownContent> : null}
            {message.isStreaming && message.content && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-full bg-primary align-middle" />
            )}
          </>
        )}
      </div>

      {!message.isStreaming && !multiSelectMode && (
        <div className="ml-10 mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            onClick={() => copyMessage(message)}
            title="复制"
            type="button"
          >
            <Copy size={15} />
          </button>
          <button
            className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            onClick={() => regenerateMessage(message)}
            title="重新生成"
            type="button"
          >
            <RotateCw size={15} />
          </button>
          <button
            className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
            onClick={() => startEditingMessage(message)}
            title="编辑"
            type="button"
          >
            <Pencil size={15} />
          </button>
          <button
            className="flex items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
            onClick={() => deleteMessage(message.id)}
            title="删除"
            type="button"
          >
            <Trash2 size={15} />
          </button>
          <MoreMenuButton
            align="left"
            items={moreItems}
            menuId={message.id}
            openMenuId={openMenuMessageId}
            setOpenMenuId={setOpenMenuMessageId}
          />
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn('relative w-full', message.role === 'user' ? 'flex justify-end' : '')}
      data-message-id={message.id}
    >
      <MessageSelectionWrapper
        isSelected={isSelected}
        message={message}
        onToggle={toggleSelectedMessage}
        selectionMode={multiSelectMode}
      >
        {body}
      </MessageSelectionWrapper>
    </div>
  );
}

