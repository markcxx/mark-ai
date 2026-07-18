"use client";

import { Download, ExternalLink, FileQuestion } from "lucide-react";

import { AppDialog } from "@/components/ui/AppDialog";

export type PreviewFile = {
  contentType: string;
  id: string;
  name: string;
  size: number;
};

const getPreviewKind = (file: PreviewFile) => {
  if (
    file.contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.name.toLowerCase().endsWith(".xlsx")
  ) {
    return "spreadsheet";
  }
  if (
    file.contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  ) {
    return "docx";
  }
  if (file.contentType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  if (file.contentType.startsWith("image/")) return "image";
  if (
    file.contentType.startsWith("text/") ||
    [".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml"].some((extension) =>
      file.name.toLowerCase().endsWith(extension),
    )
  ) {
    return "text";
  }
  return "unsupported";
};

export const isFilePreviewable = (file: PreviewFile) => getPreviewKind(file) !== "unsupported";

export function FilePreviewDialog({
  file,
  onClose,
}: {
  file: PreviewFile | null;
  onClose: () => void;
}) {
  if (!file) return null;

  const kind = getPreviewKind(file);
  const previewUrl = `/api/files/${file.id}/preview`;
  const downloadUrl = `/api/files/${file.id}/download`;
  const title = (
    <div className="flex min-w-0 items-center gap-2 pr-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>
        {file.name}
      </span>
      {kind !== "unsupported" && (
        <a
          aria-label="在新标签页打开"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-200"
          href={previewUrl}
          rel="noreferrer"
          target="_blank"
          title="在新标签页打开"
        >
          <ExternalLink size={16} />
        </a>
      )}
      <a
        aria-label="下载文件"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-200"
        href={downloadUrl}
        title="下载"
      >
        <Download size={16} />
      </a>
    </div>
  );

  return (
    <AppDialog
      bodyClassName="flex min-h-0 flex-1 overflow-hidden"
      height="min(88dvh, 860px)"
      onClose={onClose}
      open
      panelClassName="overflow-hidden"
      title={title}
      width="min(96vw, 1180px)"
      zIndex={95}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f2f3f5] dark:bg-[#101113]">
        {kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={file.name}
            className="max-h-full max-w-full object-contain p-4"
            src={previewUrl}
          />
        )}
        {(kind === "docx" || kind === "pdf" || kind === "spreadsheet" || kind === "text") && (
          <iframe
            className="h-full w-full border-0 bg-white"
            referrerPolicy="no-referrer"
            sandbox={kind === "docx" || kind === "spreadsheet" ? "" : undefined}
            src={previewUrl}
            title={`${file.name} 预览`}
          />
        )}
        {kind === "unsupported" && (
          <div className="px-6 text-center text-gray-500 dark:text-gray-400">
            <FileQuestion className="mx-auto text-gray-400" size={30} />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
              暂不支持在线预览此格式
            </p>
            <p className="mt-1 text-xs">可以下载后使用本地应用打开。</p>
          </div>
        )}
      </div>
    </AppDialog>
  );
}
