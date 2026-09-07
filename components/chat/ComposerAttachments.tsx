"use client";

import { LoaderCircle, RotateCcw, X } from "lucide-react";
import type { AttachmentUpload } from "@/hooks/use-chat-attachments";
import type { FileAttachment } from "@/lib/chat/types";
import { FileTypeIcon } from "./files/FileTypeIcon";

export function ComposerAttachments({
  attachments,
  uploads,
  onPreview,
  onRemove,
  onCancel,
  onRetry,
}: {
  attachments: FileAttachment[];
  uploads: AttachmentUpload[];
  onPreview: (file: FileAttachment) => void;
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (!attachments.length && !uploads.length) return null;
  return (
    <div
      className="flex max-h-48 flex-wrap items-start gap-2 overflow-y-auto px-3 pt-3 md:px-4"
      aria-label="消息附件"
    >
      {attachments.map((file) => (
        <div
          key={file.id}
          className="flex h-10 max-w-full items-center gap-1 rounded-md bg-gray-100/80 pl-2 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300 md:h-7"
        >
          <button
            type="button"
            aria-label={`预览 ${file.name}`}
            data-markai-tooltip={file.name}
            className="flex min-w-0 items-center gap-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => onPreview(file)}
          >
            <FileTypeIcon
              name={file.name}
              contentType={file.contentType}
              className="size-4 shrink-0"
            />
            <span className="max-w-[min(220px,55vw)] truncate">{file.name}</span>
          </button>
          <button
            type="button"
            aria-label={`移除 ${file.name}`}
            data-markai-tooltip="移除附件"
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-white/10 dark:hover:text-white md:size-7"
            onClick={() => onRemove(file.id)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      {uploads.map((file) => (
        <div
          key={file.id}
          className="relative flex min-h-16 w-[200px] max-w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-[var(--chat-input-bg)] py-2.5 pl-3 pr-9 dark:border-white/10"
        >
          <FileTypeIcon
            name={file.name}
            contentType={file.contentType}
            className="size-8 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xs font-medium text-gray-700 dark:text-gray-200"
              data-markai-tooltip={file.name}
            >
              {file.name}
            </p>
            <div
              role="status"
              className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400"
            >
              {file.stage === "error" ? (
                <button
                  type="button"
                  className="flex min-h-7 items-center gap-1 text-red-500"
                  onClick={() => onRetry(file.id)}
                  aria-label={`重试上传 ${file.name}`}
                  data-markai-tooltip={file.error}
                >
                  <RotateCcw size={12} />
                  上传失败，重试
                </button>
              ) : (
                <>
                  <LoaderCircle size={12} className="shrink-0 animate-spin" />
                  <span>
                    {file.stage === "preparing"
                      ? "准备上传…"
                      : file.stage === "uploading"
                        ? "正在上传…"
                        : "正在处理…"}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label={`取消上传 ${file.name}`}
            data-markai-tooltip="移除文件"
            className="absolute right-0 top-0 flex size-10 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 md:size-7"
            onClick={() => onCancel(file.id)}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
