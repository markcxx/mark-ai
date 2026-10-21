import {
  Calculator,
  ChartColumn,
  Check,
  Download,
  Eye,
  FileCheck2,
  FileDown,
  FilePenLine,
  FileText,
  FolderOpen,
  ListTree,
  Loader2,
  Paintbrush,
  Table2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { isFilePreviewable } from "@/components/chat/FilePreviewDialog";
import { useFileUrl } from "../FileAccessContext";
import { useHtmlPreview } from "@/components/chat/HtmlPreviewContext";
import type { GeneratedFileState } from "@/lib/chat/types";
import { getBuiltinTool } from "@/lib/tools/registry";
import { ToolCallDisclosure } from "./ToolCallDisclosure";

const formatSize = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.ceil(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;

const TOOL_ICONS: Record<string, LucideIcon> = {
  calculator: Calculator,
  "data-visualization": ChartColumn,
  "excel-workbook": Table2,
  "word-document": FileText,
};
const WORD_STEP_ICONS: Record<string, LucideIcon> = {
  word_document_begin: ListTree,
  word_document_open: FolderOpen,
  word_document_append: FileText,
  word_document_revise: FilePenLine,
  word_document_restyle: Paintbrush,
  word_document_inspect: FileCheck2,
  word_document_finalize: FileDown,
};
const TOOL_LABELS: Record<string, { running: string; done: string; error: string }> = {
  calculator: { running: "正在计算", done: "已完成计算", error: "计算失败" },
  "data-visualization": { running: "正在校验图表", done: "已生成图表", error: "图表校验失败" },
  "excel-workbook": { running: "正在生成表格", done: "已生成表格", error: "表格生成失败" },
};

const WORD_RUNNING_LABELS: Record<string, string> = {
  word_document_append: "正在构建下一个章节",
  word_document_begin: "正在规划文档结构",
  word_document_finalize: "正在打包 Word 文档",
  word_document_inspect: "正在检查文档结构与格式",
  word_document_open: "正在打开上一份可编辑 Word",
  word_document_restyle: "正在修改整份文档的样式",
  word_document_revise: "正在修改文档内容或格式",
};

export function GeneratedFileToolBlock({
  generatedFile,
  onPreview,
}: {
  generatedFile: GeneratedFileState;
  onPreview?: (file: NonNullable<GeneratedFileState["file"]>) => void;
}) {
  const htmlPreview = useHtmlPreview();
  const fileUrl = useFileUrl();
  const running = generatedFile.status === "running";
  const failed = generatedFile.status === "error";
  const file = generatedFile.file;
  const progress = generatedFile.progress;
  const livePreview = generatedFile.preview;
  const toolLabel = getBuiltinTool(generatedFile.toolId)?.name || "文件生成";
  const labels = TOOL_LABELS[generatedFile.toolId];
  const icon =
    WORD_STEP_ICONS[generatedFile.toolName] || TOOL_ICONS[generatedFile.toolId] || Wrench;
  const summaryLabel = running
    ? WORD_RUNNING_LABELS[generatedFile.toolName] || labels?.running || `正在使用${toolLabel}`
    : failed
      ? labels?.error || `${toolLabel}执行失败`
      : progress?.label || labels?.done || `已使用${toolLabel}`;

  return (
    <ToolCallDisclosure icon={icon} label={summaryLabel} status={generatedFile.status}>
      <div className="min-w-0 pl-[22px] pb-2 pt-1">
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

        {progress && !failed && (
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>{progress.detail || progress.label}</span>
              <span className="shrink-0 pl-3">
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{
                  width: `${Math.max(
                    progress.total > 0 ? (progress.current / progress.total) * 100 : 0,
                    progress.phase === "plan" ? 4 : 0,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {running && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 className="animate-spin" size={13} />
            {WORD_RUNNING_LABELS[generatedFile.toolName] || "正在执行，请稍候…"}
          </div>
        )}

        {failed && (
          <div className="mt-2 py-2 text-xs text-red-600 dark:text-red-400">
            {generatedFile.error || "文件生成失败，请稍后重试"}
          </div>
        )}

        {livePreview && !file && !failed && (
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-primary">
              {running ? <Loader2 className="animate-spin" size={13} /> : <Check size={14} />}
              {running ? "正在刷新右侧实时预览" : "右侧实时预览已更新"}
            </span>
            {htmlPreview && (
              <button
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-primary dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-primary"
                onClick={() =>
                  htmlPreview.openPreview({
                    document: livePreview,
                    id: `word-live-${livePreview.documentId}-${livePreview.revision}`,
                    kind: "word-document",
                    progress,
                    status: generatedFile.status,
                    title: livePreview.title,
                  })
                }
                type="button"
              >
                <Eye size={14} />
                查看
              </button>
            )}
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
                href={fileUrl(file.id, "download")}
              >
                <Download size={14} />
                下载
              </a>
            </div>
          </div>
        )}
      </div>
    </ToolCallDisclosure>
  );
}
