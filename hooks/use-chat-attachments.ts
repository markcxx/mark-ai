import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import toast from "react-hot-toast";

import { resolveFileContentType, uploadFile, type UploadStage } from "@/lib/client/file-upload";
import { useChatStore } from "@/stores/useChatStore";
import { useSessionStore } from "@/stores/useSessionStore";

export type AttachmentUpload = {
  id: string;
  name: string;
  contentType: string;
  stage: UploadStage | "error";
  error?: string;
};
type Task = { file: File; controller: AbortController; status: AttachmentUpload };
const discardFile = (id: string) =>
  fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);

export const useChatAttachments = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tasks = useRef(new Map<string, Task>());
  const [uploads, setUploads] = useState<AttachmentUpload[]>([]);
  const sync = () => setUploads(Array.from(tasks.current.values(), (task) => task.status));

  useEffect(() => {
    const cancelAll = () => {
      for (const task of tasks.current.values()) task.controller.abort();
      tasks.current.clear();
    };
    const unsubscribe = useSessionStore.subscribe((state, previous) => {
      if (state.activeSessionId !== previous.activeSessionId) {
        cancelAll();
        setUploads([]);
      }
    });
    return () => {
      unsubscribe();
      cancelAll();
    };
  }, []);

  const run = async (task: Task) => {
    const { id } = task.status;
    try {
      const uploaded = await uploadFile(task.file, {
        kind: "attachment",
        signal: task.controller.signal,
        onStage: (stage) => {
          if (tasks.current.get(id) !== task) return;
          task.status = { ...task.status, stage, error: undefined };
          sync();
        },
      });
      if (task.controller.signal.aborted || tasks.current.get(id) !== task) {
        void discardFile(uploaded.id);
        return;
      }
      useChatStore.getState().addPendingAttachment(uploaded);
      tasks.current.delete(id);
      sync();
    } catch (error) {
      if (task.controller.signal.aborted || tasks.current.get(id) !== task) return;
      task.status = {
        ...task.status,
        stage: "error",
        error:
          error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)
            ? error.message
            : "上传失败，请重试",
      };
      sync();
    }
  };

  const uploadAttachmentFiles = async (incomingFiles: File[] | FileList) => {
    const incoming = Array.from(incomingFiles);
    const slots = Math.max(
      0,
      4 - useChatStore.getState().pendingAttachments.length - tasks.current.size,
    );
    if (incoming.length > slots) toast.error("每条消息最多添加 4 个附件");
    const batch = incoming.slice(0, slots).map((file) => {
      const id = crypto.randomUUID();
      const task: Task = {
        file,
        controller: new AbortController(),
        status: {
          id,
          name: file.name,
          contentType: resolveFileContentType(file),
          stage: "preparing",
        },
      };
      tasks.current.set(id, task);
      return task;
    });
    sync();
    await Promise.all(batch.map(run));
  };

  const cancelUpload = (id: string) => {
    tasks.current.get(id)?.controller.abort();
    tasks.current.delete(id);
    sync();
  };
  const retryUpload = (id: string) => {
    const task = tasks.current.get(id);
    if (!task || task.status.stage !== "error") return;
    task.controller = new AbortController();
    task.status = { ...task.status, stage: "preparing", error: undefined };
    sync();
    void run(task);
  };
  const handleAttachmentFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await uploadAttachmentFiles(files);
  };
  const removeAttachment = (id: string) => {
    useChatStore.getState().removePendingAttachment(id);
    void discardFile(id);
  };

  return {
    attachmentUploading: uploads.some((task) => task.stage !== "error"),
    uploads,
    cancelUpload,
    retryUpload,
    fileInputRef,
    handleAttachmentFiles,
    removeAttachment,
    uploadAttachmentFiles,
  };
};
