'use client';

import { RefObject, useMemo, useRef } from 'react';
import {
  CheckSquare,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe2,
  Languages,
  Loader2,
  MessageSquarePlus,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCw,
  Share2,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';

import type { ConfiguredModel, MenuItem, Message, WebSearchState } from '@/lib/chat/types';
import { formatDuration, formatRelativeTime } from '@/lib/chat/metrics';
import { cn } from '@/lib/utils';

import { CollapsibleContent } from './CollapsibleContent';
import { FloatingMenu } from './FloatingMenu';
import { MarkdownContent } from './MarkdownContent';
import { MessageActionButton } from './MessageActionButton';
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
  if (message.role !== 'model' || message.isStreaming) return null;

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

const getHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function WebSearchToolBlockItem({ webSearch }: { webSearch: WebSearchState }) {

  const searching = webSearch.status === 'searching';
  const failed = webSearch.status === 'error';
  const done = webSearch.status === 'done';
  const isWebpageRead = webSearch.tool === 'read_webpage';
  const toolName = isWebpageRead ? 'read_webpage' : 'web_search';
  const toolLabel = isWebpageRead ? '网页读取' : '联网搜索';
  const argumentLabel = isWebpageRead ? 'url:' : 'query:';
  const argumentValue = isWebpageRead ? webSearch.url || webSearch.query : webSearch.query;

  return (
    <details
      className="group/tool mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors open:border-gray-300 dark:border-white/10 dark:bg-white/[0.035] dark:open:border-white/15"
      open
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
              failed
                ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300'
                : done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200',
            )}
          >
            {searching ? (
              <Loader2 className="animate-spin" size={15} />
            ) : failed ? (
              <X size={15} />
            ) : (
              <Check size={15} />
            )}
          </div>
          <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <span>{searching ? '正在调用工具' : failed ? '工具调用失败' : '工具调用完成'}</span>
            <ChevronDown className="rotate-[-90deg] text-gray-400 dark:text-gray-500" size={14} />
            <span className="font-mono text-gray-600 dark:text-gray-300">{toolName}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono text-gray-400 dark:text-gray-500">{argumentLabel}</span>
            <span className="ml-1 font-mono">{argumentValue}</span>
          </div>
        </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={cn(
              'rounded-full px-2 py-1 text-xs',
              failed
                ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400',
            )}
          >
            {searching
              ? '运行中'
              : failed
                ? '失败'
                : isWebpageRead
                  ? `已读取${webSearch.costTime ? ` · ${(webSearch.costTime / 1000).toFixed(1)}s` : ''}`
                  : `${webSearch.results.length} 个结果${
                      webSearch.costTime ? ` · ${(webSearch.costTime / 1000).toFixed(1)}s` : ''
                    }`}
          </div>
          <ChevronDown
            className="text-gray-400 transition-transform group-open/tool:rotate-180"
            size={16}
          />
        </div>
      </summary>

      {searching ? (
        <div className="border-t border-gray-100 p-3 dark:border-white/10">
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Globe2 size={14} />
            <span>
              {isWebpageRead ? '正在读取网页、提取正文和页面信息...' : '正在检索网页、整理摘要和来源...'}
            </span>
          </div>
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                className="h-[86px] min-w-[172px] animate-pulse rounded-lg border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/[0.05]"
                key={index}
              >
                <div className="m-3 h-3 w-4/5 rounded bg-gray-200 dark:bg-white/10" />
                <div className="mx-3 mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-white/10" />
                <div className="mx-3 mt-5 h-3 w-1/2 rounded bg-gray-200 dark:bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      ) : failed ? (
        <div className="border-t border-gray-100 px-3 py-3 dark:border-white/10">
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
            {webSearch.error || (isWebpageRead ? '网页读取服务暂时不可用' : '搜索服务暂时不可用')}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            已跳过{toolLabel}结果，继续使用当前模型回复。
          </div>
        </div>
      ) : isWebpageRead ? (
        <div className="border-t border-gray-100 px-3 py-3 dark:border-white/10">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {webSearch.title || webSearch.url}
              </div>
              {webSearch.description && (
                <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {webSearch.description}
                </div>
              )}
              <div className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
                {webSearch.siteName ? `${webSearch.siteName} · ` : ''}
                {webSearch.url}
              </div>
            </div>
            {webSearch.url && (
              <a
                className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                href={webSearch.url}
                rel="noreferrer"
                target="_blank"
                title="打开网页"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {webSearch.content && (
            <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 font-sans text-[13px] leading-relaxed text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
              {webSearch.content.slice(0, 2400)}
              {webSearch.content.length > 2400 ? '\n\n...' : ''}
            </pre>
          )}
        </div>
      ) : (
        <div className="border-t border-gray-100 px-1 py-2 dark:border-white/10">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs">
            <span className="shrink-0 text-gray-400 dark:text-gray-500">Query</span>
            <span className="min-w-0 truncate text-gray-900 dark:text-gray-100">
              {webSearch.query}
            </span>
          </div>
          {webSearch.answer && (
            <pre className="mx-2 my-1 max-h-[120px] overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 px-2 py-1.5 font-sans text-[13px] leading-relaxed text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
              {webSearch.answer}
            </pre>
          )}
          <div className="flex min-w-0 flex-col">
            {webSearch.results.slice(0, 8).map((result) => (
              <a
                className="group/search-result min-w-0 border-b border-gray-100 px-2 py-1.5 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
                href={result.url}
                key={result.url}
                rel="noreferrer"
                target="_blank"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-medium leading-relaxed text-gray-900 group-hover/search-result:text-sky-600 dark:text-gray-100 dark:group-hover/search-result:text-sky-300">
                    {result.title}
                  </span>
                  <ExternalLink
                    className="shrink-0 text-gray-400 opacity-0 transition-opacity group-hover/search-result:opacity-100"
                    size={12}
                  />
                </div>
                <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                  {result.url}
                </div>
                {result.content && (
                  <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {result.content}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

function WebSearchToolBlock({ webSearch }: { webSearch?: WebSearchState[] | WebSearchState }) {
  if (!webSearch) return null;
  const items = Array.isArray(webSearch) ? webSearch : [webSearch];
  if (items.length === 0) return null;
  return (
    <>
      {items.map((ws, i) => (
        <WebSearchToolBlockItem key={`${ws.tool}-${ws.query}-${i}`} webSearch={ws} />
      ))}
    </>
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
  const relativeTime = formatRelativeTime(message.createdAt);
  const absoluteTime = message.createdAt
    ? new Intl.DateTimeFormat('zh-CN', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(message.createdAt)
    : undefined;
  const body = message.role === 'user' ? (
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
        <div
          className="w-fit max-w-[92%] break-words rounded-2xl rounded-tr-sm bg-[var(--chat-user-bubble-bg)] px-4 py-3 text-left text-[15px] text-gray-900 shadow-sm whitespace-pre-wrap dark:text-gray-100 md:max-w-[85%] md:px-5"
        >
          <CollapsibleContent>{collapsed ? '消息已收起' : message.content}</CollapsibleContent>
        </div>
      )}
      {!multiSelectMode && (
        <div className="mr-1 mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <MessageActionButton
            icon={Pencil}
            onClick={() => startEditingMessage(message)}
            title="编辑"
          />
          <MessageActionButton
            icon={Copy}
            onClick={() => copyMessage(message)}
            title="复制"
          />
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
                dateTime={message.createdAt ? new Date(message.createdAt).toISOString() : undefined}
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
            <WebSearchToolBlock webSearch={message.webSearch} />
            {message.content ? <MarkdownContent>{message.content}</MarkdownContent> : null}
            {message.isStreaming && message.content && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-full bg-primary align-middle" />
            )}
            {message.interrupted && (
              <InterruptedHint
                onContinue={() => continueMessage(message)}
                onRegenerate={() => regenerateMessage(message)}
              />
            )}
            <MessageStats message={message} />
          </>
        )}
      </div>

      {!message.isStreaming && !multiSelectMode && (
        <div className="ml-10 mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <MessageActionButton
            icon={Copy}
            onClick={() => copyMessage(message)}
            title="复制"
          />
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
      className={cn('relative w-full', message.role === 'user' ? 'flex justify-end' : '')}
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
