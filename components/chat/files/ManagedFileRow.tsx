import {
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
  Trash2,
} from "lucide-react";
import { isFilePreviewable } from "../FilePreviewDialog";

export type ManagedFile = {
  contentType: string;
  createdAt: string;
  id: string;
  name: string;
  size: number;
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

function FileTypeIcon({ contentType, name }: Pick<ManagedFile, "contentType" | "name">) {
  const className = "h-5 w-5";

  if (contentType.startsWith("image/")) {
    return <FileImage className={`${className} text-blue-600 dark:text-blue-400`} />;
  }
  if (contentType.includes("spreadsheet") || name.toLowerCase().endsWith(".csv")) {
    return <FileSpreadsheet className={`${className} text-emerald-600 dark:text-emerald-400`} />;
  }
  if (contentType.includes("presentation")) {
    return <Presentation className={`${className} text-amber-600 dark:text-amber-400`} />;
  }
  return <FileText className={`${className} text-gray-600 dark:text-gray-300`} />;
}

export function ManagedFileRow({
  file,
  onDelete,
  onPreview,
}: {
  file: ManagedFile;
  onDelete: (file: ManagedFile) => void;
  onPreview: (file: ManagedFile) => void;
}) {
  return (
    <div className="group grid min-h-[68px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-200/80 px-1 py-3 dark:border-white/[0.07] sm:grid-cols-[auto_minmax(0,1fr)_150px_90px_auto] sm:gap-4 sm:px-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 dark:bg-white/[0.05] dark:ring-white/10">
        <FileTypeIcon contentType={file.contentType} name={file.name} />
      </div>
      <div className="min-w-0">
        <p
          className="truncate text-sm font-medium text-gray-800 dark:text-gray-100"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="mt-1 text-xs text-gray-400 sm:hidden">
          {formatBytes(file.size)} · {formatDate(file.createdAt)}
        </p>
      </div>
      <p className="hidden text-xs text-gray-500 dark:text-gray-400 sm:block">
        {formatDate(file.createdAt)}
      </p>
      <p className="hidden text-right text-xs tabular-nums text-gray-500 dark:text-gray-400 sm:block">
        {formatBytes(file.size)}
      </p>
      <div className="flex items-center gap-1">
        {isFilePreviewable(file) && (
          <button
            aria-label={`预览 ${file.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-100"
            onClick={() => onPreview(file)}
            title="预览"
            type="button"
          >
            <Eye size={16} />
          </button>
        )}
        <a
          aria-label={`下载 ${file.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-100"
          href={`/api/files/${file.id}/download`}
          title="下载"
        >
          <Download size={16} />
        </a>
        <button
          aria-label={`删除 ${file.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          onClick={() => onDelete(file)}
          title="删除"
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
