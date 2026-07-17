"use client";

import { RefObject, useMemo, useRef } from "react";
import {
  CheckSquare,
  Copy,
  FileText,
  Download,
  Languages,
  MessageSquarePlus,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCw,
  Share2,
  Trash2,
  Volume2,
} from "lucide-react";

import type { ConfiguredModel, MenuItem, Message, MessageSegment } from "@/lib/chat/types";
import { formatDuration, formatRelativeTime } from "@/lib/chat/metrics";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

import { CollapsibleContent } from "./CollapsibleContent";
import { FloatingMenu } from "./FloatingMenu";
import { MarkdownContent } from "./MarkdownContent";
import { MessageActionButton } from "./MessageActionButton";
import { MessageSelectionWrapper } from "./MessageSelectionWrapper";
import { ModelAvatar } from "./ModelAvatar";
import { ThinkingPanel } from "./ThinkingPanel";
import { WebSearchToolBlock, WebSearchToolBlockItem } from "./message/WebSearchToolBlock";

function MoreMenuButton({
  align,
  items,
  menuId,
  openMenuId,
  setOpenMenuId,
}: {
  align: "left" | "right";
  items: MenuItem[];
  menuId: string;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const open = openMenuId === menuId;

  return (
    <>
      <MessageActionButton
        icon={MoreHorizontal}
        onClick={() => setOpenMenuId(open ? null : menuId)}
        ref={buttonRef}
        title="更多"
      />
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

function MessageStats({ message }: { message: Message }) {
  if (message.role !== "model" || message.isStreaming) return null;

  const duration = formatDuration(message.generationDuration);
  const items = [
    message.inputTokens ? `输入约 ${message.inputTokens}` : undefined,
    message.outputTokens ? `输出约 ${message.outputTokens}` : undefined,
    message.totalTokens ? `共约 ${message.totalTokens} tokens` : undefined,
    duration ? `耗时 ${duration}` : undefined,
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 opacity-0 transition-opacity duration-200 group-hover/message:opacity-100 dark:text-gray-500">
      {items.map((item, index) => (
        <span className="inline-flex items-center gap-2" key={item}>
          {index > 0 && <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />}
          {item}
        </span>
      ))}
    </div>
  );
}

function InterruptedHint({
  onContinue,
  onRegenerate,
}: {
  onContinue: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
      <span>已中断 · 接下来需要做什么？</span>
      <button
        className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
        onClick={onContinue}
        type="button"
      >
        <Play size={12} />
        继续生成
      </button>
      <button
        className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
        onClick={onRegenerate}
        type="button"
      >
        <RotateCw size={12} />
        重新生成
      </button>
    </div>
  );
}

export function MessageItem({
  cancelEditingMessage,
  collapsed,
  continueMessage,
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
  selectionLayoutMode,
  setEditingContent,
  setOpenMenuMessageId,
  startEditingMessage,
  toggleCollapseMessage,
  toggleSelectedMessage,
}: {
  cancelEditingMessage: () => void;
  collapsed: boolean;
  continueMessage: (message: Message) => Promise<void>;
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
  selectionLayoutMode: boolean;
  setEditingContent: (content: string) => void;
  setOpenMenuMessageId: (id: string | null) => void;
  startEditingMessage: (message: Message) => void;
  toggleCollapseMessage: (id: string) => void;
  toggleSelectedMessage: (id: string, shiftKey?: boolean) => void;
}) {
  const generalSettings = useSettingsStore((state) => state.general);
  const moreItems = useMemo<MenuItem[]>(
    () => [
      { icon: Pencil, label: "编辑", onClick: () => startEditingMessage(message) },
      { icon: Copy, label: "复制", onClick: () => copyMessage(message) },
      { icon: MessageSquarePlus, label: "创建子话题", onClick: menuUnavailable },
      {
        icon: Minimize2,
        label: collapsed ? "展开消息" : "收起消息",
        onClick: () => toggleCollapseMessage(message.id),
      },
      { icon: Volume2, label: "语音朗读", onClick: menuUnavailable },
      { icon: Languages, label: "翻译", onClick: menuUnavailable },
      { icon: Share2, label: "分享", onClick: menuUnavailable },
      { icon: CheckSquare, label: "多选", onClick: () => enableMultiSelect(message.id) },
      { icon: RotateCw, label: "重新生成", onClick: () => regenerateMessage(message) },
      {
        danger: true,
        icon: RotateCw,
        label: "删除并重新生成",
        onClick: () => regenerateMessage(message, true),
      },
      { danger: true, icon: Trash2, label: "删除", onClick: () => deleteMessage(message.id) },
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
  const relativeTime = formatRelativeTime(message.createdAt);
  const absoluteTime = message.createdAt
    ? new Intl.DateTimeFormat("zh-CN", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(message.createdAt)
    : undefined;
  const body =
    message.role === "user" ? (
      <div className="group group/message relative flex w-full flex-col items-end">
        {relativeTime && (
          <time
            className="mb-2 mr-1 text-xs text-gray-400 opacity-0 transition-opacity duration-200 group-hover/message:opacity-100 dark:text-gray-500"
            dateTime={message.createdAt ? new Date(message.createdAt).toISOString() : undefined}
            title={absoluteTime}
          >
            {relativeTime}
          </time>
        )}
        {editing ? (
          <div className="w-full max-w-[92%] rounded-2xl rounded-tr-sm bg-[var(--chat-user-bubble-bg)] p-3 shadow-sm md:max-w-[85%]">
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
          <div className="flex w-fit max-w-[92%] flex-col gap-3 break-words rounded-2xl rounded-tr-sm bg-[var(--chat-user-bubble-bg)] px-4 py-3 text-left text-[length:var(--chat-font-size)] text-gray-900 shadow-sm dark:text-gray-100 md:max-w-[85%] md:px-5">
            {message.attachments && message.attachments.length > 0 && !collapsed && (
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((file) => (
                  <a
                    className="flex min-w-0 max-w-[260px] items-center gap-2 rounded-xl border border-black/[0.06] bg-white/60 px-2.5 py-2 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                    href={`/api/files/${file.id}/download`}
                    key={file.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-500/15 dark:text-blue-300">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{file.name}</span>
                      <span className="block text-[10px] text-gray-400">
                        {file.size < 1024 * 1024
                          ? `${Math.ceil(file.size / 1024)} KB`
                          : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                      </span>
                    </span>
                    <Download className="shrink-0 text-gray-400" size={14} />
                  </a>
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap">
              <CollapsibleContent>{collapsed ? "消息已收起" : message.content}</CollapsibleContent>
            </div>
          </div>
        )}
        {!multiSelectMode && (
          <div className="mr-1 mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <MessageActionButton
              icon={Pencil}
              onClick={() => startEditingMessage(message)}
              title="编辑"
            />
            <MessageActionButton icon={Copy} onClick={() => copyMessage(message)} title="复制" />
            <MessageActionButton
              danger
              icon={Trash2}
              onClick={() => deleteMessage(message.id)}
              title="删除"
            />
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
      <div className="group group/message relative w-full">
        <div className="message-header mb-3 flex items-center gap-2.5">
          <ModelAvatar model={message.model} provider={message.provider} />
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-jakarta text-[15px] font-bold text-gray-900 dark:text-gray-100">
                {message.model || selectedModel?.id}
              </span>
              {relativeTime && (
                <time
                  className="shrink-0 text-xs text-gray-400 opacity-0 transition-opacity duration-200 group-hover/message:opacity-100 dark:text-gray-500"
                  dateTime={
                    message.createdAt ? new Date(message.createdAt).toISOString() : undefined
                  }
                  title={absoluteTime}
                >
                  {relativeTime}
                </time>
              )}
            </div>
            {message.isStreaming && (
              <span className="mt-0.5 animate-pulse text-xs font-medium text-gray-400">
                {loadingText}
              </span>
            )}
          </div>
        </div>

        <div className="markdown-body ml-10 text-[length:var(--chat-font-size)] leading-relaxed text-gray-900 dark:text-gray-100">
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
              {message.segments && message.segments.length > 0 ? (
                <>
                  {!message.segments.some((segment) => segment.type === "thinking") && (
                    <ThinkingPanel
                      content={message.reasoning}
                      duration={message.reasoningDuration}
                      thinking={message.isReasoning}
                    />
                  )}
                  {message.segments.map((seg, i) => {
                    if (seg.type === "thinking") {
                      return (
                        <ThinkingPanel
                          content={seg.content}
                          duration={seg.duration}
                          key={`seg-${i}`}
                          thinking={seg.isActive}
                        />
                      );
                    }
                    if (seg.type === "tool") {
                      return <WebSearchToolBlockItem key={`seg-${i}`} webSearch={seg.webSearch} />;
                    }
                    return seg.content ? (
                      <div key={`seg-${i}`}>
                        <MarkdownContent
                          animation={generalSettings.responseAnimation}
                          streaming={message.isStreaming && i === message.segments!.length - 1}
                        >
                          {seg.content}
                        </MarkdownContent>
                        {message.isStreaming && i === message.segments!.length - 1 && (
                          <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-full bg-primary align-middle" />
                        )}
                      </div>
                    ) : null;
                  })}
                </>
              ) : (
                <>
                  <ThinkingPanel
                    content={message.reasoning}
                    duration={message.reasoningDuration}
                    thinking={message.isReasoning}
                  />
                  <WebSearchToolBlock webSearch={message.webSearch} />
                  {message.content ? (
                    <MarkdownContent
                      animation={generalSettings.responseAnimation}
                      streaming={message.isStreaming}
                    >
                      {message.content}
                    </MarkdownContent>
                  ) : null}
                  {message.isStreaming && message.content && (
                    <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-full bg-primary align-middle" />
                  )}
                </>
              )}
              {message.interrupted && (
                <InterruptedHint
                  onContinue={() => continueMessage(message)}
                  onRegenerate={() => regenerateMessage(message)}
                />
              )}
              {generalSettings.showMessageStats && <MessageStats message={message} />}
            </>
          )}
        </div>

        {!message.isStreaming && !multiSelectMode && (
          <div className="ml-10 mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <MessageActionButton icon={Copy} onClick={() => copyMessage(message)} title="复制" />
            <MessageActionButton
              icon={RotateCw}
              onClick={() => regenerateMessage(message)}
              title="重新生成"
            />
            <MessageActionButton
              icon={Pencil}
              onClick={() => startEditingMessage(message)}
              title="编辑"
            />
            <MessageActionButton
              danger
              icon={Trash2}
              onClick={() => deleteMessage(message.id)}
              title="删除"
            />
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
      className={cn("relative w-full", message.role === "user" ? "flex justify-end" : "")}
      data-message-id={message.id}
    >
      <MessageSelectionWrapper
        isSelected={isSelected}
        message={message}
        onToggle={toggleSelectedMessage}
        selectionInteractive={multiSelectMode}
        selectionMode={selectionLayoutMode}
      >
        {body}
      </MessageSelectionWrapper>
    </div>
  );
}
