"use client";

import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Copy,
  GitBranch,
  Languages,
  MessageSquarePlus,
  Minimize2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Quote,
  RotateCw,
  Share2,
  Trash2,
  Volume2,
} from "lucide-react";
import toast from "react-hot-toast";

import type {
  ConfiguredModel,
  FileAttachment,
  MenuItem,
  Message,
  MessageSegment,
  RegenerateMode,
} from "@/lib/chat/types";
import { collectMessageCitations } from "@/lib/chat/citations";
import { formatDuration, formatRelativeTime } from "@/lib/chat/metrics";
import { cn } from "@/lib/utils";
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from "@/lib/chat/translation-languages";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { AppTextArea } from "@/components/ui/AppInput";
import { useSpeechPlayback } from "@/hooks/useSpeechPlayback";
import { getSpeechVoiceLabel, SYSTEM_SPEECH_VOICE } from "@/lib/chat/speech-voices";
import { resolveAgentAvatarMode } from "@/lib/chat/agent-avatar";

import { AgentAvatar } from "./AgentAvatar";
import { CollapsibleContent } from "./CollapsibleContent";
import { FloatingMenu } from "./FloatingMenu";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { FileTypeIcon } from "./files/FileTypeIcon";
import { FirstTokenLoader } from "./FirstTokenLoader";
import { ImageGenerationSkeleton } from "./ImageGenerationSkeleton";
import { MarkdownContent } from "./MarkdownContent";
import { MessageAudioPlayer } from "./MessageAudioPlayer";
import { MessageActionButton } from "./MessageActionButton";
import { MessageSelectionWrapper } from "./MessageSelectionWrapper";
import { ThinkingPanel } from "./ThinkingPanel";
import { GeneratedFileToolBlock } from "./message/GeneratedFileToolBlock";
import { GeneratedImageBlock } from "./message/GeneratedImageBlock";
import { WebSearchToolBlock, WebSearchToolBlockItem } from "./message/WebSearchToolBlock";
import { MessageSources } from "./message/MessageSources";
import { isImageGenerationModel } from "@/lib/chat/image-models";

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

function MessageEditor({
  className,
  content,
  onCancel,
  onChange,
  onSave,
}: {
  className?: string;
  content: string;
  onCancel: () => void;
  onChange: (content: string) => void;
  onSave: () => void;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-gray-200 bg-[var(--chat-input-bg)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)]",
        className,
      )}
    >
      <AppTextArea
        aria-label="编辑消息内容"
        autoFocus
        className="max-h-[55dvh] min-h-[180px] resize-y px-3 py-3 text-[length:var(--chat-font-size)] leading-relaxed md:min-h-[220px]"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSave();
          }
        }}
        value={content}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="h-9 rounded-md px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.07]"
          onClick={onCancel}
          type="button"
        >
          取消
        </button>
        <button
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-85 dark:text-gray-900"
          onClick={onSave}
          type="button"
        >
          保存
        </button>
      </div>
    </div>
  );
}

const getAttachmentTypeLabel = (file: FileAttachment) => {
  const lowerName = file.name.toLocaleLowerCase();
  if (
    file.contentType.includes("spreadsheet") ||
    [".csv", ".xls", ".xlsx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return "电子表格";
  }
  if (
    file.contentType.includes("wordprocessing") ||
    file.contentType === "application/msword" ||
    [".doc", ".docx"].some((extension) => lowerName.endsWith(extension))
  ) {
    return "Word 文档";
  }
  if (file.contentType === "application/pdf" || lowerName.endsWith(".pdf")) return "PDF 文档";
  if (file.contentType.startsWith("image/")) return "图片";
  if (file.contentType.startsWith("audio/")) return "音频";
  if (file.contentType.startsWith("video/")) return "视频";
  if (file.contentType.startsWith("text/")) return "文本文件";
  return "文件";
};

const formatAttachmentSize = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.ceil(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;

function MessageStats({ message }: { message: Message }) {
  if (message.role !== "model" || message.isStreaming) return null;

  const duration = formatDuration(message.generationDuration);
  const approximate = message.tokenUsageSource !== "provider" ? "约 " : "";
  const items = [
    message.inputTokens ? `输入${approximate}${message.inputTokens}` : undefined,
    message.outputTokens ? `输出${approximate}${message.outputTokens}` : undefined,
    message.totalTokens ? `共${approximate}${message.totalTokens} tokens` : undefined,
    duration ? `耗时 ${duration}` : undefined,
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover/message:opacity-100 dark:text-gray-500">
      {items.map((item, index) => (
        <span className="inline-flex items-center gap-2" key={item}>
          {index > 0 && <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />}
          {item}
        </span>
      ))}
    </div>
  );
}

function MessageTranslation({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const translation = message.segments?.find((segment) => segment.type === "translation");
  if (!translation || translation.type !== "translation") return null;

  return (
    <section className="mt-4 border-t border-gray-200/80 pt-4 dark:border-white/[0.09]">
      <button
        aria-expanded={expanded}
        className="flex min-h-9 items-center gap-1.5 rounded-md pr-2 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <Languages size={13} />
        译文 · {translation.language}
        <ChevronDown
          className={cn("transition-transform duration-200", expanded && "rotate-180")}
          size={13}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-3 text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
            <MarkdownContent>{translation.content}</MarkdownContent>
          </div>
        </div>
      </div>
    </section>
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

function MessageVariantSwitcher({
  message,
  onSelect,
}: {
  message: Message;
  onSelect: (messageId: string, variantId: string) => Promise<void>;
}) {
  const variants = message.variants || [];
  if (variants.length < 2) return null;

  const activeIndex = Math.max(
    0,
    variants.findIndex((variant) => variant.id === message.activeVariantId),
  );
  const selectAt = (index: number) => {
    const variant = variants[index];
    if (variant) void onSelect(message.id, variant.id);
  };

  return (
    <div className="inline-flex h-7 items-center rounded-md bg-gray-50/80 text-xs text-gray-400 dark:bg-white/[0.04] dark:text-gray-500">
      <button
        aria-label="查看上一个答案"
        className="flex h-full w-7 items-center justify-center rounded-l-lg transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 dark:hover:bg-white/[0.07] dark:hover:text-gray-100"
        disabled={activeIndex === 0}
        onClick={() => selectAt(activeIndex - 1)}
        type="button"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="min-w-10 px-1 text-center tabular-nums">
        {activeIndex + 1} / {variants.length}
      </span>
      <button
        aria-label="查看下一个答案"
        className="flex h-full w-7 items-center justify-center rounded-r-lg transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 dark:hover:bg-white/[0.07] dark:hover:text-gray-100"
        disabled={activeIndex === variants.length - 1}
        onClick={() => selectAt(activeIndex + 1)}
        type="button"
      >
        <ChevronRight size={14} />
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
  isConversationTail,
  isSelected,
  loadingText,
  menuUnavailable,
  message,
  multiSelectMode,
  openMenuMessageId,
  regenerateMessage,
  readOnly = false,
  saveEditingMessage,
  selectMessageVariant,
  selectedModel,
  selectionLayoutMode,
  setEditingContent,
  setOpenMenuMessageId,
  startEditingMessage,
  toggleCollapseMessage,
  toggleSelectedMessage,
  translateMessage,
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
  isConversationTail: boolean;
  isSelected: boolean;
  loadingText: string;
  menuUnavailable: () => void;
  message: Message;
  multiSelectMode: boolean;
  openMenuMessageId: string | null;
  readOnly?: boolean;
  regenerateMessage: (message: Message, mode?: RegenerateMode) => Promise<void>;
  saveEditingMessage: () => void;
  selectMessageVariant: (messageId: string, variantId: string) => Promise<void>;
  selectedModel?: ConfiguredModel;
  selectionLayoutMode: boolean;
  setEditingContent: (content: string) => void;
  setOpenMenuMessageId: (id: string | null) => void;
  startEditingMessage: (message: Message) => void;
  toggleCollapseMessage: (id: string) => void;
  toggleSelectedMessage: (id: string, shiftKey?: boolean) => void;
  translateMessage: (message: Message, language: TranslationLanguage) => Promise<void>;
}) {
  const generalSettings = useSettingsStore((state) => state.general);
  const speechSettings = useSettingsStore((state) => state.speech);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [showInterruptedAlert, setShowInterruptedAlert] = useState(Boolean(message.interrupted));
  const [translating, setTranslating] = useState(false);
  const speechToastIdRef = useRef<string | undefined>(undefined);
  const dismissSpeechToast = useCallback(() => {
    if (!speechToastIdRef.current) return;
    toast.dismiss(speechToastIdRef.current);
    speechToastIdRef.current = undefined;
  }, []);
  const speech = useSpeechPlayback({
    onError: (error) => {
      dismissSpeechToast();
      toast.error(error, { duration: 4000 });
    },
    onPlaybackStart: dismissSpeechToast,
  });
  const {
    pause: pauseSpeech,
    replay: replaySpeech,
    resume: resumeSpeech,
    start: startSpeech,
    state: speechState,
    stop: stopSpeech,
    chunkCount: speechChunkCount,
    chunkIndex: speechChunkIndex,
    currentTime: speechCurrentTime,
    duration: speechDuration,
    voice: activeSpeechVoice,
  } = speech;
  const hasStreamingOutput = Boolean(
    message.content?.trim() ||
    message.reasoning?.trim() ||
    message.webSearch?.length ||
    message.segments?.some((segment) => {
      if (segment.type === "content" || segment.type === "thinking") {
        return Boolean(segment.content.trim());
      }
      return segment.type !== "translation";
    }),
  );
  const waitingForFirstOutput = Boolean(message.isStreaming && !hasStreamingOutput);
  const waitingForImage = waitingForFirstOutput && isImageGenerationModel(message.model);
  const avatarMode = resolveAgentAvatarMode(
    message,
    isConversationTail,
    waitingForImage,
    showInterruptedAlert,
  );
  const regenerateMode: RegenerateMode = generalSettings.overwriteRegeneratedResponse
    ? "replace"
    : "preserve";
  useEffect(() => {
    if (!message.interrupted) {
      setShowInterruptedAlert(false);
      return;
    }
    setShowInterruptedAlert(true);
    const timer = window.setTimeout(() => setShowInterruptedAlert(false), 2400);
    return () => window.clearTimeout(timer);
  }, [message.id, message.interrupted]);
  const handleTranslate = useCallback(
    async (language: TranslationLanguage) => {
      setTranslating(true);
      const toastId = toast.loading("正在生成译文…", { duration: Infinity });
      try {
        await translateMessage(message, language);
        toast.success("译文已生成", { duration: 2200, id: toastId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "翻译失败，请稍后重试", {
          duration: 3500,
          id: toastId,
        });
      } finally {
        setTranslating(false);
      }
    },
    [message, translateMessage],
  );
  const handleSpeech = useCallback(() => {
    if (speechState === "loading") {
      dismissSpeechToast();
      stopSpeech();
      return;
    }
    if (speechState === "playing") {
      pauseSpeech();
      return;
    }
    if (speechState === "paused") {
      resumeSpeech();
      return;
    }
    dismissSpeechToast();
    speechToastIdRef.current = toast.loading("正在生成语音…", { duration: Infinity });
    startSpeech(message.content || "", speechSettings.voice);
  }, [
    dismissSpeechToast,
    message.content,
    pauseSpeech,
    resumeSpeech,
    speechState,
    speechSettings.voice,
    startSpeech,
    stopSpeech,
  ]);
  useEffect(() => dismissSpeechToast, [dismissSpeechToast]);
  const speechItem = useMemo(
    () => ({
      icon:
        speechState === "playing"
          ? Pause
          : speechState === "paused" || speechState === "ended"
            ? Play
            : Volume2,
      label:
        speechState === "loading"
          ? "停止生成语音"
          : speechState === "playing"
            ? "暂停朗读"
            : speechState === "paused"
              ? "继续朗读"
              : speechState === "ended"
                ? "重新播放"
                : "语音朗读",
      onClick: speechState === "ended" ? replaySpeech : handleSpeech,
    }),
    [handleSpeech, replaySpeech, speechState],
  );
  const hasTextContent = Boolean(message.content.trim());
  const moreItems = useMemo<MenuItem[]>(
    () => [
      ...(message.role === "user" || hasTextContent
        ? [{ icon: Pencil, label: "编辑", onClick: () => startEditingMessage(message) }]
        : []),
      { icon: Copy, label: "复制", onClick: () => copyMessage(message) },
      { icon: MessageSquarePlus, label: "创建子话题", onClick: menuUnavailable },
      {
        icon: Minimize2,
        label: collapsed ? "展开消息" : "收起消息",
        onClick: () => toggleCollapseMessage(message.id),
      },
      ...(message.role === "model" && hasTextContent ? [speechItem] : []),
      ...(hasTextContent
        ? [
            {
              icon: Languages,
              label: translating ? "翻译中…" : "翻译",
              submenu: TRANSLATION_LANGUAGES.map((language) => ({
                label: language.label,
                onClick: () => {
                  if (!translating) void handleTranslate(language.value);
                },
              })),
            },
          ]
        : []),
      { icon: Share2, label: "分享", onClick: menuUnavailable },
      { icon: CheckSquare, label: "多选", onClick: () => enableMultiSelect(message.id) },
      {
        icon: RotateCw,
        label: "重新生成",
        onClick: () => regenerateMessage(message, regenerateMode),
      },
      { danger: true, icon: Trash2, label: "删除", onClick: () => deleteMessage(message.id) },
    ],
    [
      collapsed,
      copyMessage,
      deleteMessage,
      enableMultiSelect,
      handleTranslate,
      hasTextContent,
      menuUnavailable,
      message,
      regenerateMode,
      regenerateMessage,
      startEditingMessage,
      speechItem,
      toggleCollapseMessage,
      translating,
    ],
  );

  const editing = editingMessageId === message.id;
  const contextBoundary = message.segments?.find((segment) => segment.type === "context-boundary");
  const quotedSelection = message.segments?.find((segment) => segment.type === "quote");
  const contentSegments = message.segments?.filter(
    (segment) => segment.type !== "context-boundary",
  );
  const citations = useMemo(() => collectMessageCitations(message), [message]);
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
            className="mb-2 mr-1 text-xs text-gray-400 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover/message:opacity-100 dark:text-gray-500"
            dateTime={message.createdAt ? new Date(message.createdAt).toISOString() : undefined}
            title={absoluteTime}
          >
            {relativeTime}
          </time>
        )}
        {editing ? (
          <MessageEditor
            className="max-w-[720px]"
            content={editingContent}
            onCancel={cancelEditingMessage}
            onChange={setEditingContent}
            onSave={saveEditingMessage}
          />
        ) : (
          <>
            {quotedSelection?.type === "quote" && (
              <div className="mb-1 flex max-w-[92%] items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs leading-5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300 md:max-w-[85%]">
                <Quote className="mt-0.5 shrink-0" size={14} />
                <span className="line-clamp-2">{quotedSelection.content}</span>
              </div>
            )}
            {message.attachments && message.attachments.length > 0 && !collapsed && (
              <div className="mb-2 flex w-full max-w-[360px] flex-col items-stretch gap-2">
                {message.attachments.map((file) => (
                  <button
                    aria-label={`预览 ${file.name}`}
                    className="group/file grid min-h-16 w-full grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm transition-[border-color,background-color,box-shadow] hover:border-gray-300 hover:bg-gray-50/70 hover:shadow-md dark:border-white/10 dark:bg-[#191919] dark:hover:border-white/20 dark:hover:bg-[#1d1d1d]"
                    key={file.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewFile(file);
                    }}
                    type="button"
                  >
                    <FileTypeIcon
                      className="h-[22px] w-[22px]"
                      contentType={file.contentType}
                      name={file.name}
                      tile
                      tileClassName="h-11 w-11"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {file.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                        {getAttachmentTypeLabel(file)} · {formatAttachmentSize(file.size)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex w-fit max-w-[92%] flex-col gap-3 break-words rounded-2xl rounded-tr-sm bg-[var(--chat-user-bubble-bg)] px-4 py-3 text-left text-[length:var(--chat-font-size)] text-gray-900 shadow-sm dark:text-gray-100 md:max-w-[85%] md:px-5">
              <div className="whitespace-pre-wrap">
                <CollapsibleContent>
                  {collapsed ? "消息已收起" : message.content}
                </CollapsibleContent>
              </div>
              {!collapsed && <MessageTranslation message={message} />}
            </div>
          </>
        )}
        {!readOnly && !multiSelectMode && (
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
      <div className="group group/message relative w-full" data-message-id={message.id}>
        <div className="message-header mb-3 flex items-center gap-2.5">
          <AgentAvatar
            ambient={avatarMode.ambient}
            animate={avatarMode.animate}
            expression={avatarMode.expression}
            reduceMotion={generalSettings.reduceMotion}
            state={avatarMode.state}
          />
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-jakarta text-[15px] font-bold text-gray-900 dark:text-gray-100">
                {message.model || selectedModel?.id || "MarkAI"}
              </span>
              {relativeTime && (
                <time
                  className="shrink-0 text-xs text-gray-400 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover/message:opacity-100 dark:text-gray-500"
                  dateTime={
                    message.createdAt ? new Date(message.createdAt).toISOString() : undefined
                  }
                  title={absoluteTime}
                >
                  {relativeTime}
                </time>
              )}
            </div>
            {waitingForFirstOutput && !waitingForImage && (
              <span className="mt-0.5 animate-pulse text-xs font-medium text-gray-400">
                {loadingText}
              </span>
            )}
          </div>
        </div>

        <div
          className="markdown-body ml-10 text-[length:var(--chat-font-size)] leading-relaxed text-gray-900 dark:text-gray-100"
          data-message-id={message.id}
          data-selection-quote-source="true"
        >
          {editing ? (
            <MessageEditor
              content={editingContent}
              onCancel={cancelEditingMessage}
              onChange={setEditingContent}
              onSave={saveEditingMessage}
            />
          ) : collapsed ? (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              消息已收起
            </div>
          ) : (
            <>
              {waitingForImage ? (
                <ImageGenerationSkeleton />
              ) : (
                waitingForFirstOutput && <FirstTokenLoader />
              )}
              {contentSegments &&
              contentSegments.some((segment) => segment.type !== "translation") ? (
                <>
                  {!contentSegments.some((segment) => segment.type === "thinking") && (
                    <ThinkingPanel
                      content={message.reasoning}
                      duration={message.reasoningDuration}
                      thinking={message.isReasoning}
                    />
                  )}
                  {contentSegments.map((seg, i) => {
                    if (seg.type === "translation") return null;
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
                    if (seg.type === "generated-file") {
                      return (
                        <GeneratedFileToolBlock
                          generatedFile={seg.generatedFile}
                          key={`seg-${i}`}
                          onPreview={setPreviewFile}
                        />
                      );
                    }
                    if (seg.type === "generated-image") {
                      return (
                        <GeneratedImageBlock
                          generatedImage={seg.generatedImage}
                          key={`seg-${i}`}
                          onPreview={setPreviewFile}
                        />
                      );
                    }
                    return seg.content ? (
                      <div key={`seg-${i}`}>
                        <MarkdownContent
                          animation={generalSettings.responseAnimation}
                          citations={citations}
                          streaming={message.isStreaming && i === contentSegments.length - 1}
                        >
                          {seg.content}
                        </MarkdownContent>
                        {message.isStreaming && i === contentSegments.length - 1 && (
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
                      citations={citations}
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
              {!message.isStreaming && <MessageTranslation message={message} />}
              {speechState !== "idle" && (
                <MessageAudioPlayer
                  chunkCount={speechChunkCount}
                  chunkIndex={speechChunkIndex}
                  currentTime={speechCurrentTime}
                  duration={speechDuration}
                  onPause={pauseSpeech}
                  onReplay={replaySpeech}
                  onResume={resumeSpeech}
                  onStop={() => {
                    dismissSpeechToast();
                    stopSpeech();
                  }}
                  state={speechState}
                  voice={
                    activeSpeechVoice === SYSTEM_SPEECH_VOICE
                      ? "系统默认音色"
                      : getSpeechVoiceLabel(activeSpeechVoice)
                  }
                />
              )}
              {!message.isStreaming && <MessageSources citations={citations} />}
              {message.interrupted && !readOnly && (
                <InterruptedHint
                  onContinue={() => continueMessage(message)}
                  onRegenerate={() => void regenerateMessage(message, "replace")}
                />
              )}
              {readOnly && message.interrupted && (
                <p className="mt-3 text-xs text-gray-400">本条回复已中断</p>
              )}
              {generalSettings.showMessageStats && <MessageStats message={message} />}
            </>
          )}
        </div>

        {!readOnly && !message.isStreaming && !multiSelectMode && (
          <div className="ml-10 mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <MessageActionButton icon={Copy} onClick={() => copyMessage(message)} title="复制" />
            <MessageActionButton
              icon={RotateCw}
              onClick={() => regenerateMessage(message, regenerateMode)}
              title="重新生成"
            />
            <MessageVariantSwitcher message={message} onSelect={selectMessageVariant} />
            {hasTextContent && (
              <MessageActionButton
                icon={Pencil}
                onClick={() => startEditingMessage(message)}
                title="编辑"
              />
            )}
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
    <>
      {contextBoundary && (
        <div className="flex w-full items-center gap-3 py-1 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
          <span className="flex shrink-0 items-center gap-1.5">
            <GitBranch size={13} />
            以下消息基于上方回复的旧版本
          </span>
          <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        </div>
      )}
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
      <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
    </>
  );
}
