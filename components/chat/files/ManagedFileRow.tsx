import { Download, Eye, Trash2 } from "lucide-react";

import { AdminCheckbox } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils";

import { isFilePreviewable } from "../FilePreviewDialog";
import { FileTypeIcon } from "./FileTypeIcon";

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

export const formatManagedFileDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const getFileTypeLabel = (file: ManagedFile) => {
  const extension = file.name.split(".").pop()?.trim().toLocaleUpperCase();
  if (extension && extension !== file.name.toLocaleUpperCase()) return extension;
  return file.contentType.split("/").pop()?.toLocaleUpperCase() || "文件";
};

function FileActions({
  file,
  onDelete,
  onPreview,
}: {
  file: ManagedFile;
  onDelete: (file: ManagedFile) => void;
  onPreview: (file: ManagedFile) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {isFilePreviewable(file) && (
        <button
          aria-label={`预览 ${file.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
          data-markai-tooltip="预览"
          onClick={() => onPreview(file)}
          type="button"
        >
          <Eye size={15} />
        </button>
      )}
      <a
        aria-label={`下载 ${file.name}`}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
        data-markai-tooltip="下载"
        href={`/api/files/${file.id}/download`}
      >
        <Download size={15} />
      </a>
      <button
        aria-label={`删除 ${file.name}`}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        data-markai-tooltip="删除"
        onClick={() => onDelete(file)}
        type="button"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

type ManagedFileRowProps = {
  file: ManagedFile;
  index: number;
  isSelected: boolean;
  onDelete: (file: ManagedFile) => void;
  onPreview: (file: ManagedFile) => void;
  onToggleSelected: (fileId: string, checked: boolean) => void;
};

export function ManagedFileTableRow({
  file,
  index,
  isSelected,
  onDelete,
  onPreview,
  onToggleSelected,
}: ManagedFileRowProps) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-gray-100/80 dark:hover:bg-white/[0.06]",
        index % 2 === 0 && "bg-gray-50/55 dark:bg-white/[0.018]",
        isSelected && "bg-gray-100/80 dark:bg-white/[0.055]",
      )}
    >
      <td className="w-12 px-3 py-3">
        <AdminCheckbox
          checked={isSelected}
          label={`选择文件 ${file.name}`}
          onChange={(checked) => onToggleSelected(file.id, checked)}
        />
      </td>
      <td className="min-w-0 px-5 py-3">
        <button
          className="flex min-w-0 max-w-full items-center gap-3 text-left"
          onClick={() => isFilePreviewable(file) && onPreview(file)}
          type="button"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 dark:bg-white/[0.05] dark:ring-white/10">
            <FileTypeIcon contentType={file.contentType} name={file.name} />
          </span>
          <span className="truncate font-medium" title={file.name}>
            {file.name}
          </span>
        </button>
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
        {getFileTypeLabel(file)}
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
        {formatManagedFileDate(file.createdAt)}
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {formatBytes(file.size)}
      </td>
      <td className="px-3 py-3">
        <FileActions file={file} onDelete={onDelete} onPreview={onPreview} />
      </td>
    </tr>
  );
}

export function ManagedFileMobileRow({
  file,
  index,
  isSelected,
  onDelete,
  onPreview,
  onToggleSelected,
}: ManagedFileRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[28px_40px_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-3 transition-colors",
        index % 2 === 0 && "bg-gray-50/70 dark:bg-white/[0.018]",
        isSelected && "bg-gray-100 dark:bg-white/[0.055]",
      )}
    >
      <AdminCheckbox
        checked={isSelected}
        label={`选择文件 ${file.name}`}
        onChange={(checked) => onToggleSelected(file.id, checked)}
      />
      <button
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200 dark:bg-white/[0.05] dark:ring-white/10"
        onClick={() => isFilePreviewable(file) && onPreview(file)}
        type="button"
      >
        <FileTypeIcon contentType={file.contentType} name={file.name} />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="mt-1 truncate text-xs text-gray-400">
          {getFileTypeLabel(file)} · {formatBytes(file.size)} ·{" "}
          {formatManagedFileDate(file.createdAt)}
        </p>
        <div className="mt-1.5 -ml-1 flex justify-start">
          <FileActions file={file} onDelete={onDelete} onPreview={onPreview} />
        </div>
      </div>
    </div>
  );
}
