"use client";

import { Download, FileJson, ImageDown } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { AppDialog } from "@/components/ui/AppDialog";
import {
  buildSessionExportPayload,
  exportSessionImage,
  exportSessionJson,
  formatExportDateTime,
  getExportTitle,
} from "@/lib/chat/exporters";
import type { ChatSession, Message } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

import { MarkdownContent } from "./MarkdownContent";
import { ModelAvatar } from "./ModelAvatar";

export type ExportMode = "image" | "json";

const PREVIEW_ID = "markai-export-preview";

function ExportPreviewMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-[var(--chat-user-bubble-bg)] px-5 py-3 text-[15px] leading-relaxed text-gray-900 shadow-sm whitespace-pre-wrap dark:text-gray-100 dark:shadow-none">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <ModelAvatar model={message.model} size={32} />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="truncate font-jakarta text-[15px] font-bold text-gray-900 dark:text-gray-100">
            {message.model || "MARKAI"}
          </span>
          {message.createdAt && (
            <span className="shrink-0 text-xs text-gray-400">
              {formatExportDateTime(message.createdAt)}
            </span>
          )}
        </div>
        {message.reasoning && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
            {message.reasoning}
          </div>
        )}
        <div className="markdown-body text-[15px] leading-relaxed text-gray-900 dark:text-gray-100">
          <MarkdownContent>{message.content}</MarkdownContent>
        </div>
      </div>
    </div>
  );
}

function ExportImagePreview({
  messages,
  session,
}: {
  messages: Message[];
  session?: ChatSession | null;
}) {
  const title = getExportTitle(session);
  const visibleMessages = messages.filter((message) => message.content.trim());
  const modelLabel = session?.model
    ? `${session.provider || "model"} / ${session.model}`
    : "MARKAI conversation";

  return (
    <div className="mx-auto w-[780px] max-w-full bg-[#f1f5f9] p-6 dark:bg-[#0e0f11]">
      <div
        className="overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-white/10 dark:bg-[#111214] dark:text-gray-100 dark:shadow-none"
        id={PREVIEW_ID}
      >
        <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-white/10 dark:bg-[#111214]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 dark:bg-white/[0.06]">
              <Image alt="MARKAI" height={28} src="/images/markai.svg" width={28} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold text-gray-950 dark:text-gray-50">
                {title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{visibleMessages.length} 条消息</span>
                <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span>{modelLabel}</span>
                {session?.updatedAt && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span>更新于 {formatExportDateTime(session.updatedAt)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 bg-white px-6 py-7 dark:bg-[#111214]">
          {visibleMessages.length > 0 ? (
            visibleMessages.map((message) => (
              <ExportPreviewMessage key={message.id} message={message} />
            ))
          ) : (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              暂无可导出的消息
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-2 border-t border-gray-200 bg-white px-6 py-5 text-center dark:border-white/10 dark:bg-[#111214]">
          <div className="flex items-center justify-center gap-2">
            <Image alt="MARKAI" height={24} src="/images/markai.svg" width={24} />
            <span className="font-jakarta text-sm font-bold tracking-wide text-gray-950 dark:text-gray-50">
              MARKAI
            </span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">Generated by MARKAI</div>
        </div>
      </div>
    </div>
  );
}

export function ExportDialog({
  initialMode,
  messages,
  onClose,
  open,
  session,
}: {
  initialMode: ExportMode;
  messages: Message[];
  onClose: () => void;
  open: boolean;
  session?: ChatSession | null;
}) {
  const [mode, setMode] = useState<ExportMode>(initialMode);
  const [imageLoading, setImageLoading] = useState(false);
  const exportPayload = useMemo(
    () => buildSessionExportPayload(session, messages),
    [messages, session],
  );
  const jsonPreview = useMemo(() => JSON.stringify(exportPayload, null, 2), [exportPayload]);

  const handleDownloadImage = async () => {
    setMode("image");
    setImageLoading(true);
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await exportSessionImage({ previewId: PREVIEW_ID, session });
      toast.success("图片已导出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片导出失败");
    } finally {
      setImageLoading(false);
    }
  };

  const handleDownloadJson = () => {
    exportSessionJson(session, messages);
    toast.success("JSON 已导出");
  };

  return (
    <AppDialog
      bodyClassName="flex min-h-0 flex-1"
      closeDisabled={imageLoading}
      height="92dvh"
      onClose={onClose}
      open={open}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">导出会话</span>
          <span className="hidden truncate text-sm font-normal text-gray-400 sm:inline">
            {getExportTitle(session)}
          </span>
        </span>
      }
      width={1152}
      zIndex={50}
    >
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_280px] md:grid-rows-1">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 gap-1 border-b border-gray-200 px-3 py-2 dark:border-white/10 md:hidden">
            {[
              { icon: ImageDown, key: "image" as const, label: "图片预览" },
              { icon: FileJson, key: "json" as const, label: "JSON 预览" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm transition-colors",
                    mode === item.key
                      ? "bg-gray-950 text-white dark:bg-white dark:text-gray-950"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]",
                  )}
                  key={item.key}
                  onClick={() => setMode(item.key)}
                  type="button"
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-3 dark:bg-black/30 md:p-5">
            {mode === "image" ? (
              <ExportImagePreview messages={messages} session={session} />
            ) : (
              <pre className="min-h-full overflow-auto rounded-xl border border-gray-200 bg-white p-4 text-xs leading-5 text-gray-700 shadow-sm dark:border-white/10 dark:bg-[#111214] dark:text-gray-300">
                {jsonPreview}
              </pre>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-gray-200 p-4 dark:border-white/10 md:border-l md:border-t-0">
          <div className="hidden gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06] md:flex">
            {[
              { icon: ImageDown, key: "image" as const, label: "图片" },
              { icon: FileJson, key: "json" as const, label: "JSON" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={cn(
                    "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm transition-colors",
                    mode === item.key
                      ? "bg-white text-gray-950 shadow-sm dark:bg-[#262626] dark:text-white"
                      : "text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white",
                  )}
                  key={item.key}
                  onClick={() => setMode(item.key)}
                  type="button"
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="text-sm leading-6 text-gray-500 dark:text-gray-400">
            图片会按左侧预览导出，保留聊天气泡、Markdown 样式和底部 MARKAI 标识。JSON
            会导出完整结构化数据。
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 md:grid-cols-1">
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.06]"
              onClick={handleDownloadJson}
              type="button"
            >
              <FileJson size={16} />
              导出 JSON
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 text-sm text-white transition-colors hover:bg-gray-800 disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
              disabled={imageLoading}
              onClick={handleDownloadImage}
              type="button"
            >
              {imageLoading ? (
                <Download className="animate-pulse" size={16} />
              ) : (
                <ImageDown size={16} />
              )}
              {imageLoading ? "生成中" : "导出图片"}
            </button>
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
