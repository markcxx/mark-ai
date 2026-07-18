import { Check, Download, Eye, FileOutput, Loader2, X } from "lucide-react";

import { isFilePreviewable } from "@/components/chat/FilePreviewDialog";
import type { GeneratedFileState } from "@/lib/chat/types";
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

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            failed
              ? "border-red-200 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300"
              : "border-primary/20 bg-primary/5 text-primary dark:border-primary/25 dark:bg-primary/10",
          )}
        >
          {running ? (
            <Loader2 className="animate-spin" size={19} />
          ) : failed ? (
            <X size={19} />
          ) : (
            <FileOutput size={19} />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {running ? "正在生成文件" : failed ? "文件生成失败" : file?.name || "文件已生成"}
            {!running && !failed && <Check className="text-emerald-500" size={15} />}
          </span>
          <span className="mt-1 block truncate font-mono text-xs text-gray-400 dark:text-gray-500">
            {generatedFile.toolName}
            {file ? ` · ${formatSize(file.size)}` : ""}
          </span>
          {failed && generatedFile.error && (
            <span className="mt-1 block text-xs text-red-600 dark:text-red-300">
              {generatedFile.error}
            </span>
          )}
        </span>

        {file && !failed && (
          <div className="flex shrink-0 items-center gap-1.5">
            {onPreview && isFilePreviewable(file) && (
              <button
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition-colors hover:border-primary/25 hover:bg-primary/5 hover:text-primary dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-primary/30 dark:hover:bg-primary/10 dark:hover:text-primary"
                onClick={() => onPreview(file)}
                type="button"
              >
                <Eye size={15} />
                预览
              </button>
            )}
            <a
              className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 text-xs font-medium text-primary transition-colors hover:border-primary/30 hover:bg-primary/10 dark:border-primary/25 dark:bg-primary/10 dark:hover:bg-primary/15"
              download
              href={file.url}
            >
              <Download size={15} />
              下载
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
