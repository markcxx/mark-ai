"use client";

import type { RefObject } from "react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowDown,
  ChevronRight,
  CornerDownRight,
  Globe,
  LoaderCircle,
  Mic,
  Paperclip,
  SendHorizontal,
  Square,
  X,
} from "lucide-react";

import type {
  ConfiguredModel,
  FileAttachment,
  Message,
  QueuedChatMessage,
  QuotedSelection,
} from "@/lib/chat/types";
import { getModelDisplayName } from "@/lib/chat/helpers";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { cn } from "@/lib/utils";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { GlobeOffIcon } from "@/components/icons/GlobeOffIcon";
import { ContextWindowIndicator } from "./ContextWindowIndicator";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { ModelSelectorDialog } from "./ModelSelectorDialog";
import { ModelBrandIcon } from "./ModelBrandIcon";
import { ToolMenu } from "./ToolMenu";
import { ComposerAttachments } from "./ComposerAttachments";
import type { AttachmentUpload } from "@/hooks/use-chat-attachments";

export function ChatInput({
  availableModels,
  input,
  isLoading,
  isLoadingModels,
  modelSearchKeyword,
  messages,
  onAttachment,
  onDropFiles,
  attachments,
  attachmentUploading,
  uploads,
  onCancelUpload,
  onRetryUpload,
  onRemoveAttachment,
  onInput,
  onKeyDown,
  onPaste,
  onClearQuote,
  onScrollToBottom,
  onMic,
  onCancelQueuedMessage,
  onSendQueuedMessageNow,
  onSend,
  placement = "bottom",
  providerNames,
  pendingQuote,
  queuedMessage,
  showScrollToBottom = false,
  selectedModel,
  selectedModelKey,
  setModelSearchKeyword,
  setSelectedModelKey,
  textareaRef,
  webSearchEnabled,
  onToggleWebSearch,
}: {
  availableModels: ConfiguredModel[];
  attachments: FileAttachment[];
  attachmentUploading: boolean;
  uploads: AttachmentUpload[];
  onCancelUpload: (id: string) => void;
  onRetryUpload: (id: string) => void;
  input: string;
  isLoading: boolean;
  isLoadingModels: boolean;
  modelSearchKeyword: string;
  messages: Message[];
  onAttachment: () => void;
  onDropFiles: (files: File[] | FileList) => Promise<void>;
  onRemoveAttachment: (id: string) => void;
  onInput: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onClearQuote: () => void;
  onScrollToBottom?: () => void;
  onMic: () => void;
  onCancelQueuedMessage: () => void;
  onSendQueuedMessageNow: () => void;
  onSend: () => void;
  placement?: "bottom" | "center";
  providerNames: Record<string, string>;
  pendingQuote: QuotedSelection | null;
  queuedMessage: QueuedChatMessage | null;
  showScrollToBottom?: boolean;
  selectedModel?: ConfiguredModel;
  selectedModelKey: string;
  setModelSearchKeyword: (keyword: string) => void;
  setSelectedModelKey: (key: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
}) {
  const dragDepthRef = useRef(0);
  const [attachmentDragActive, setAttachmentDragActive] = useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const hasDraft = Boolean(input.trim() || attachments.length > 0);
  const stopping = isLoading && !hasDraft;
  const imageGenerationModel = isImageGenerationModel(selectedModel?.id);

  return (
    <>
      <div
        className={cn(
          placement === "bottom"
            ? "pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-8 md:p-4 md:px-8 md:pb-8 md:pt-10"
            : "w-full",
        )}
      >
        {placement === "bottom" && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 right-[6px] bg-gradient-to-t from-[var(--chat-input-overlay-from)] via-[var(--chat-input-overlay-via)] to-transparent"
          />
        )}
        <div
          className={cn(
            "relative flex w-full flex-col transition-[max-width] duration-300 ease-out",
            placement === "bottom" ? "pointer-events-auto max-w-[840px]" : "max-w-[760px]",
          )}
        >
          {placement === "bottom" && showScrollToBottom && onScrollToBottom && (
            <button
              className="mx-auto mb-2 flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-[var(--chat-input-bg)] px-3 text-xs font-medium text-gray-600 shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition-colors hover:text-gray-950 dark:border-white/10 dark:text-gray-300 dark:shadow-[0_8px_22px_rgba(0,0,0,0.28)] dark:hover:text-white"
              onClick={onScrollToBottom}
              type="button"
            >
              <ArrowDown size={14} />
              回到底部
            </button>
          )}
          {queuedMessage && (
            <div className="relative z-10 mx-auto -mb-1 flex h-11 w-[calc(100%-24px)] min-w-0 items-center rounded-xl border border-gray-200 bg-[var(--chat-input-bg)] pl-3 pr-1 text-xs text-gray-500 shadow-[0_6px_18px_rgba(0,0,0,0.07)] dark:border-white/10 dark:text-gray-400 dark:shadow-[0_8px_22px_rgba(0,0,0,0.26)] md:h-10">
              <LoaderCircle className="shrink-0 animate-spin text-primary" size={14} />
              <span className="ml-2 shrink-0 font-medium text-gray-700 dark:text-gray-200">
                等待发送
              </span>
              <span className="ml-2 min-w-0 flex-1 truncate">
                {queuedMessage.content}
                {queuedMessage.attachments.length > 0
                  ? ` · ${queuedMessage.attachments.length} 个附件`
                  : ""}
                {queuedMessage.quote ? " · 含引用" : ""}
              </span>
              <button
                aria-label="立即发送待发送消息"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/[0.08] dark:hover:text-white md:h-8 md:w-8"
                data-markai-tooltip="停止当前回复并立即发送"
                onClick={onSendQueuedMessageNow}
                type="button"
              >
                <SendHorizontal size={14} />
              </button>
              <button
                aria-label="取消待发送消息"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500 dark:hover:bg-white/[0.08] md:h-8 md:w-8"
                data-markai-tooltip="取消待发送"
                onClick={onCancelQueuedMessage}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div
            className="relative z-20 flex flex-col rounded-xl border border-gray-200 bg-[var(--chat-input-bg)] shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all duration-300 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20 dark:border-white/10 dark:shadow-[0_14px_40px_rgba(0,0,0,0.35)] dark:focus-within:border-white/20 dark:focus-within:ring-white/[0.06]"
            onDragEnter={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              dragDepthRef.current += 1;
              setAttachmentDragActive(true);
            }}
            onDragLeave={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
              if (dragDepthRef.current === 0) setAttachmentDragActive(false);
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.types.includes("Files")) return;
              event.preventDefault();
              event.stopPropagation();
              dragDepthRef.current = 0;
              setAttachmentDragActive(false);
              const files = Array.from(event.dataTransfer.items)
                .filter((item) => item.kind === "file" && !item.webkitGetAsEntry?.()?.isDirectory)
                .map((item) => item.getAsFile())
                .filter((file): file is File => file !== null);
              if (event.dataTransfer.items.length && !files.length) {
                toast.error("暂不支持上传文件夹，请拖入具体文件");
                return;
              }
              void onDropFiles(event.dataTransfer.items.length ? files : event.dataTransfer.files);
            }}
          >
            {attachmentDragActive && (
              <div
                role="status"
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-[var(--chat-input-bg)] text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                松开即可添加附件
              </div>
            )}
            {pendingQuote && (
              <div className="mx-3 mt-3 flex min-w-0 items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-500 dark:bg-white/[0.05] dark:text-gray-400 md:mx-4">
                <CornerDownRight className="mt-0.5 shrink-0 text-gray-400" size={15} />
                <span className="line-clamp-3 min-w-0 flex-1">{pendingQuote.content}</span>
                <button
                  aria-label="移除引用"
                  className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-100"
                  data-markai-tooltip="移除引用"
                  onClick={onClearQuote}
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <ComposerAttachments
              attachments={attachments}
              uploads={uploads}
              onPreview={setPreviewFile}
              onRemove={onRemoveAttachment}
              onCancel={onCancelUpload}
              onRetry={onRetryUpload}
            />

            <textarea
              data-markai-composer
              className="max-h-[36dvh] min-h-[56px] w-full resize-none border-none bg-transparent px-3 py-3 text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-500 md:max-h-[200px] md:min-h-[64px] md:px-4 md:py-4 md:text-[15px]"
              disabled={!selectedModel}
              onChange={onInput}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={
                selectedModel
                  ? imageGenerationModel
                    ? "描述想生成的画面，或上传图片继续修改..."
                    : "尽管问，带图也行..."
                  : "正在加载可用模型列表……"
              }
              ref={textareaRef}
              rows={1}
              value={input}
            />

            <div className="flex flex-wrap items-center justify-between gap-y-1 px-2.5 pb-2.5 pt-1 md:px-3 md:pb-3">
              <div className="flex items-center gap-1">
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 md:h-9 md:w-9"
                  onClick={onAttachment}
                  disabled={attachmentUploading || attachments.length + uploads.length >= 4}
                  title="添加附件"
                  type="button"
                >
                  <Paperclip size={20} />
                </button>
                <button
                  className="hidden h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 md:flex md:h-9 md:w-9"
                  onClick={onMic}
                  title="语音输入"
                  type="button"
                >
                  <Mic size={20} />
                </button>
                <ToolMenu disabled={isLoading || imageGenerationModel} />
                <button
                  className={cn(
                    "flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors md:h-9",
                    webSearchEnabled
                      ? "text-primary hover:bg-primary/5 dark:text-primary dark:hover:bg-primary/10"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200",
                    (isLoading || imageGenerationModel) && "cursor-not-allowed opacity-60",
                  )}
                  data-markai-tooltip={
                    imageGenerationModel ? "图片生成模型暂不支持联网搜索" : undefined
                  }
                  disabled={isLoading || imageGenerationModel}
                  onClick={onToggleWebSearch}
                  title={
                    imageGenerationModel
                      ? "图片生成模型暂不支持联网搜索"
                      : webSearchEnabled
                        ? "关闭联网搜索"
                        : "开启联网搜索"
                  }
                  type="button"
                >
                  {webSearchEnabled ? <Globe size={18} /> : <GlobeOffIcon size={18} />}
                  <span className="hidden text-sm sm:inline">联网搜索</span>
                  <span className="hidden sm:inline-flex">
                    <ToggleSwitch checked={webSearchEnabled} disabled={isLoading} />
                  </span>
                </button>
              </div>
              <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-2">
                {messages.length > 0 && (
                  <span className="shrink-0">
                    <ContextWindowIndicator
                      attachments={attachments}
                      draft={pendingQuote ? `${pendingQuote.content}\n\n${input}` : input}
                      messages={messages}
                      modelId={selectedModel?.id}
                      webSearchEnabled={webSearchEnabled}
                    />
                  </span>
                )}
                <button
                  className="flex h-11 max-w-[240px] items-center gap-2 rounded-lg px-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-700 md:h-9"
                  disabled={isLoadingModels || availableModels.length === 0}
                  onClick={() => {
                    if (availableModels.length > 0) setIsModelDialogOpen(true);
                  }}
                  title="选择模型"
                  type="button"
                >
                  {selectedModel ? (
                    <>
                      <ModelBrandIcon
                        model={selectedModel.id}
                        provider={selectedModel.provider}
                        size={20}
                      />
                      <span className="hidden max-w-[160px] truncate text-[13px] sm:inline">
                        {getModelDisplayName(selectedModel.id)}
                      </span>
                    </>
                  ) : (
                    <span className="max-w-[120px] truncate">
                      {isLoadingModels ? "加载中" : "未配置模型"}
                    </span>
                  )}
                  <ChevronRight className="shrink-0 text-gray-400" size={14} />
                </button>
                <button
                  aria-label={stopping ? "停止生成" : isLoading ? "加入待发送" : "发送消息"}
                  className={cn(
                    "relative flex h-11 w-11 min-w-11 items-center justify-center overflow-hidden rounded-full bg-gray-950 text-white shadow-sm transition-transform duration-150 ease-out hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:scale-100 dark:bg-white dark:text-gray-950 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 md:h-9 md:w-9 md:min-w-9",
                    stopping &&
                      "bg-red-500 text-white hover:bg-red-600 dark:bg-red-500 dark:text-white dark:hover:bg-red-600",
                  )}
                  disabled={
                    (!input.trim() && attachments.length === 0 && !isLoading) ||
                    !selectedModel ||
                    attachmentUploading ||
                    (isLoading && Boolean(queuedMessage) && hasDraft)
                  }
                  onClick={onSend}
                  title={stopping ? "停止生成" : isLoading ? "加入待发送" : "发送"}
                  type="button"
                >
                  {stopping ? (
                    <>
                      <span className="absolute inset-1 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <Square className="relative z-10" fill="currentColor" size={11} />
                    </>
                  ) : (
                    <SendHorizontal size={17} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 hidden text-center font-jakarta text-xs text-gray-400 sm:block">
            内容由 AI 生成，请注意甄别。
          </p>
        </div>
      </div>

      <ModelSelectorDialog
        availableModels={availableModels}
        modelSearchKeyword={modelSearchKeyword}
        onClose={() => {
          setIsModelDialogOpen(false);
          setModelSearchKeyword("");
        }}
        open={isModelDialogOpen}
        providerNames={providerNames}
        selectedModelKey={selectedModelKey}
        setModelSearchKeyword={setModelSearchKeyword}
        setSelectedModelKey={setSelectedModelKey}
      />
      <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
    </>
  );
}
