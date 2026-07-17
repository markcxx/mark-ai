import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import toast from "react-hot-toast";

import { uploadFile } from "@/lib/client/file-upload";
import { useChatStore } from "@/stores/useChatStore";

export const useChatAttachments = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const handleAttachmentFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const slots = Math.max(0, 4 - useChatStore.getState().pendingAttachments.length);
    const files = Array.from(event.target.files || []).slice(0, slots);
    event.target.value = "";
    if (files.length === 0) return;

    setAttachmentUploading(true);
    try {
      for (const file of files) {
        const uploaded = await uploadFile(file, { kind: "attachment" });
        useChatStore.getState().addPendingAttachment(uploaded);
      }
      toast.success(files.length === 1 ? "附件已就绪" : `${files.length} 个附件已就绪`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "附件上传失败");
    } finally {
      setAttachmentUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    useChatStore.getState().removePendingAttachment(id);
    void fetch(`/api/files/${id}`, { method: "DELETE" });
  };

  return {
    attachmentUploading,
    fileInputRef,
    handleAttachmentFiles,
    removeAttachment,
  };
};
