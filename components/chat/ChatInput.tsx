"use client";

import type { RefObject } from "react";
import { useState } from "react";
import {
  ChevronRight,
  FileText,
  Globe,
  LoaderCircle,
  Mic,
  Paperclip,
  SendHorizontal,
  Square,
  X,
} from "lucide-react";

import type { ConfiguredModel, FileAttachment, Message } from "@/lib/chat/types";
import { getModelDisplayName } from "@/lib/chat/helpers";
import { cn } from "@/lib/utils";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { GlobeOffIcon } from "@/components/icons/GlobeOffIcon";
import { ContextWindowIndicator } from "./ContextWindowIndicator";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { ModelSelectorDialog } from "./ModelSelectorDialog";
import { ModelBrandIcon } from "./ModelBrandIcon";
import { ToolMenu } from "./ToolMenu";

export function ChatInput({
  availableModels,
  input,
  isLoading,
  isLoadingModels,
  modelSearchKeyword,
  messages,
  onAttachment,
  attachments,
  attachmentUploading,
  onRemoveAttachment,
  onInput,
  onKeyDown,
  onMic,
  onSend,
  placement = "bottom",
  providerNames,
  selectedModel,
  selectedModelKey,
  setModelSearchKeyword,
  setSelectedModelKey,
  textareaRef,
  webSearchEnabled,
  onToggleWebSearch,
  wide = false,
}: {
  availableModels: ConfiguredModel[];
  attachments: FileAttachment[];
  attachmentUploading: boolean;
  input: string;
  isLoading: boolean;
  isLoadingModels: boolean;
  modelSearchKeyword: string;
  messages: Message[];
  onAttachment: () => void;
  onRemoveAttachment: (id: string) => void;
  onInput: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMic: () => void;
  onSend: () => void;
  placement?: "bottom" | "center";
  providerNames: Record<string, string>;
  selectedModel?: ConfiguredModel;
  selectedModelKey: string;
  setModelSearchKeyword: (keyword: string) => void;
  setSelectedModelKey: (key: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  wide?: boolean;
}) {
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);

  return (
    <>
      <div
        className={cn(
          placement === "bottom"
            ? "pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex justify-center bg-gradient-to-t from-[var(--chat-input-overlay-from)] via-[var(--chat-input-overlay-via)] to-transparent px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-8 md:p-4 md:px-8 md:pb-8 md:pt-10"
            : "w-full",
        )}
      >
        <div
          className={cn(
            "w-full transition-[max-width] duration-300 ease-out",
            placement === "bottom"
              ? cn("pointer-events-auto", wide ? "max-w-full" : "max-w-[840px]")
              : "max-w-[760px]",
          )}
        >
          <div className="relative flex flex-col rounded-xl border border-gray-200 bg-[var(--chat-input-bg)] shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all duration-300 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20 dark:border-white/10 dark:shadow-[0_14px_40px_rgba(0,0,0,0.35)] dark:focus-within:border-white/20 dark:focus-within:ring-white/[0.06]">
            <textarea
              className="max-h-[36dvh] min-h-[56px] w-full resize-none border-none bg-transparent px-3 py-3 text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-500 md:max-h-[200px] md:min-h-[64px] md:px-4 md:py-4 md:text-[15px]"
              disabled={isLoading || !selectedModel}
              onChange={onInput}
              onKeyDown={onKeyDown}
              placeholder={selectedModel ? "尽管问，带图也行..." : "正在加载可用模型列表……"}
              ref={textareaRef}
              rows={1}
              value={input}
            />

            {(attachments.length > 0 || attachmentUploading) && (
              <div className="flex gap-2 overflow-x-auto px-3 pb-2 md:px-4">
                {attachments.map((file) => (
                  <div
                    className="group/file flex max-w-[240px] shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]"
                    key={file.id}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setPreviewFile(file)}
                      title={`预览 ${file.name}`}
                      type="button"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-500 shadow-sm dark:bg-white/10 dark:text-blue-300">
                        <FileText size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                          {file.name}
                        </span>
                        <span className="block text-[10px] text-gray-400">
                          {file.size < 1024 * 1024
                            ? `${Math.ceil(file.size / 1024)} KB`
                            : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                        </span>
                      </span>
                    </button>
                    <button
                      aria-label="移除附件"
                      className="ml-1 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                      onClick={() => onRemoveAttachment(file.id)}
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {attachmentUploading && (
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/70 px-3 py-2 text-xs text-blue-600 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300">
                    <LoaderCircle className="animate-spin" size={16} />
                    正在安全上传…
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1 md:px-3 md:pb-3">
              <div className="flex items-center gap-1">
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 md:h-9 md:w-9"
                  onClick={onAttachment}
                  disabled={isLoading || attachmentUploading || attachments.length >= 4}
                  title="添加附件"
                  type="button"
                >
                  <Paperclip size={20} />
                </button>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 md:h-9 md:w-9"
                  onClick={onMic}
                  title="语音输入"
                  type="button"
                >
                  <Mic size={20} />
                </button>
                <ToolMenu disabled={isLoading} />
                <button
                  className={cn(
                    "flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors md:h-9",
                    webSearchEnabled
                      ? "text-primary hover:bg-primary/5 dark:text-primary dark:hover:bg-primary/10"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200",
                    isLoading && "cursor-not-allowed opacity-60",
                  )}
                  disabled={isLoading}
                  onClick={onToggleWebSearch}
                  title={webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
                  type="button"
                >
                  {webSearchEnabled ? <Globe size={18} /> : <GlobeOffIcon size={18} />}
                  <span className="hidden text-sm sm:inline">联网搜索</span>
                  <ToggleSwitch checked={webSearchEnabled} disabled={isLoading} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <ContextWindowIndicator
                  attachments={attachments}
                  draft={input}
                  messages={messages}
                  modelId={selectedModel?.id}
                  webSearchEnabled={webSearchEnabled}
                />
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
                  aria-label={isLoading ? "停止生成" : "发送消息"}
                  className={cn(
                    "relative flex h-11 w-11 min-w-11 items-center justify-center overflow-hidden rounded-full bg-gray-950 text-white shadow-sm transition-transform duration-150 ease-out hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:scale-100 dark:bg-white dark:text-gray-950 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 md:h-9 md:w-9 md:min-w-9",
                    isLoading &&
                      "bg-red-500 text-white hover:bg-red-600 dark:bg-red-500 dark:text-white dark:hover:bg-red-600",
                  )}
                  disabled={
                    (!input.trim() && attachments.length === 0 && !isLoading) ||
                    !selectedModel ||
                    attachmentUploading
                  }
                  onClick={onSend}
                  title={isLoading ? "停止生成" : "发送"}
                  type="button"
                >
                  {isLoading ? (
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
