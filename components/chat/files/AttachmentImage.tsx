"use client";

import AppImage from "@/components/ui/AppImage";
import type { FileAttachment } from "@/lib/chat/types";
import { useFileUrl } from "../FileAccessContext";

export function AttachmentImage({ file }: { file: FileAttachment }) {
  const fileUrl = useFileUrl();
  return (
    <AppImage
      native
      src={fileUrl(file.id, "preview")}
      alt={file.name}
      loading="lazy"
      containerClassName="h-full w-full"
      containerStyle={{ aspectRatio: undefined }}
      className="h-full w-full object-contain"
    />
  );
}
