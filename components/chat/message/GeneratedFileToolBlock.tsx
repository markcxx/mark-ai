import { Check, ChevronRight, Download, Eye, FileOutput, Loader2, X } from "lucide-react";

import { isFilePreviewable } from "@/components/chat/FilePreviewDialog";
import type { GeneratedFileState } from "@/lib/chat/types";
import { getBuiltinTool } from "@/lib/tools/registry";
import { cn } from "@/lib/utils";

const formatSize = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.ceil(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;

export function GeneratedFileToolBlock({
  generatedFile,
  onPreview,
}: {
  generatedFile: GeneratedFileState;
  onPreview?: (file: NonNullable<GeneratedFileState["file"]>) => void;
}) {
  const running = generatedFile.status === "running";
  const failed = generatedFile.status === "error";
  const file = generatedFile.file;
  const toolLabel = getBuiltinTool(generatedFile.toolId)?.name || "文件生成";
  const summaryLabel = running
    ? `正在调用${toolLabel}`
    : failed
      ? `${toolLabel}调用失败`
      : `已调用${toolLabel}`;

  return (
    <details className="group/file-tool mb-2.5 overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors open:border-gray-300 dark:border-white/10 dark:bg-white/[0.025] dark:open:border-white/15">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
            failed
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
              : "bg-primary/10 text-primary",
          )}
        >
          {running ? (
            <Loader2 className="animate-spin" size={12} />
          ) : failed ? (
            <X size={12} />
          ) : (
            <FileOutput size={12} />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-medium",
            failed ? "text-red-600 dark:text-red-300" : "text-gray-600 dark:text-gray-300",
          )}
        >
          {summaryLabel}
        </span>
        <ChevronRight
          className="shrink-0 text-gray-400 transition-transform duration-200 group-open/file-tool:-rotate-90"
          size={14}
        />
      </summary>

      <div className="border-t border-gray-100 px-3 py-2.5 dark:border-white/[0.08]">
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-500">
            {generatedFile.toolName}
          </span>
          {file && (
            <>
              <span className="h-3 w-px shrink-0 bg-gray-200 dark:bg-white/10" />
              <span className="min-w-0 truncate text-gray-700 dark:text-gray-300">{file.name}</span>
              <span className="ml-auto shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                {formatSize(file.size)}
              </span>
            </>
          )}
        </div>

        {running && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 className="animate-spin" size={13} />
            正在生成文件，请稍候…
          </div>
        )}

        {failed && (
          <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
            {generatedFile.error || "文件生成失败，请稍后重试"}
          </div>
        )}

        {file && !failed && (
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <Check size={14} />
              文件已生成
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {onPreview && isFilePreviewable(file) && (
                <button
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-primary"
                  onClick={() => onPreview(file)}
                  type="button"
                >
                  <Eye size={14} />
                  预览
                </button>
              )}
              <a
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                download
                href={file.url}
              >
                <Download size={14} />
                下载
              </a>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
