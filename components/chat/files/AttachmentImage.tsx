"use client";

import { useState } from "react";
import type { FileAttachment } from "@/lib/chat/types";
import { useFileUrl } from "../FileAccessContext";

export function AttachmentImage({ file }: { file: FileAttachment }) {
  const fileUrl = useFileUrl();
  const src = fileUrl(file.id, "preview");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-100 p-2 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
        <span>图片加载失败</span>
        <span className="max-w-full truncate">{file.name}</span>
      </span>
    );
  }

  return (
    // Preview URLs retain the current authenticated or shared-file access scope.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={file.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className="block h-full w-full bg-gray-100 object-contain dark:bg-white/5"
    />
  );
}
