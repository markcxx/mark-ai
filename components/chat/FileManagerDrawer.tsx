"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Files,
  HardDrive,
  LoaderCircle,
  Plus,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { uploadFile } from "@/lib/client/file-upload";
import { useChatStore } from "@/stores/useChatStore";

import { formatBytes, ManagedFileRow } from "./files/ManagedFileRow";
import type { ManagedFile } from "./files/ManagedFileRow";

const ACCEPTED_FILES = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.docx,.xlsx,.pptx";

type FilesResponse = {
  files: ManagedFile[];
  limits: {
    maxFileBytes: number;
    maxFileCount: number | null;
    maxStorageBytes: number | null;
  };
  usage: {
    count: number;
    size: number;
  };
};

export function FileManagerDrawer({ onClose, open }: { onClose: () => void; open: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<FilesResponse | null>(null);
  const [deletingFile, setDeletingFile] = useState<ManagedFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [upload, setUpload] = useState<{
    completed: number;
    current: string;
    total: number;
  } | null>(null);

  const loadFiles = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/files", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "无法加载文件");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法加载文件");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;

    void fetch("/api/files", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "无法加载文件");
        return body as FilesResponse;
      })
      .then((body) => {
        if (!active) return;
        setData(body);
        setError("");
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "无法加载文件");
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deletingFile) setDeletingFile(null);
      else onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deletingFile, onClose, open]);

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return data?.files || [];
    return (data?.files || []).filter((file) =>
      file.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [data?.files, query]);

  const uploadFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0 || upload) return;

    let uploaded = 0;
    let firstError = "";
    setUpload({ completed: 0, current: selectedFiles[0].name, total: selectedFiles.length });

    for (const [index, file] of selectedFiles.entries()) {
      setUpload({ completed: index, current: file.name, total: selectedFiles.length });
      try {
        await uploadFile(file, { kind: "attachment" });
        uploaded += 1;
      } catch (uploadError) {
        firstError ||= uploadError instanceof Error ? uploadError.message : "文件上传失败";
      }
    }

    setUpload(null);
    await loadFiles();
    if (uploaded > 0) toast.success(uploaded === 1 ? "文件已上传" : `${uploaded} 个文件已上传`);
    if (firstError) toast.error(firstError);
  };

  const handleDelete = async () => {
    if (!deletingFile || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/files/${deletingFile.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "删除失败");

      useChatStore.getState().removePendingAttachment(deletingFile.id);
      setData((current) =>
        current
          ? {
              ...current,
              files: current.files.filter((file) => file.id !== deletingFile.id),
              usage: {
                count: Math.max(0, current.usage.count - 1),
                size: Math.max(0, current.usage.size - deletingFile.size),
              },
            }
          : current,
      );
      setDeletingFile(null);
      toast.success("文件已删除");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const storagePercentage = data?.limits.maxStorageBytes
    ? Math.min(100, (data.usage.size / data.limits.maxStorageBytes) * 100)
    : 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] bg-black/25"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.section
            animate={{ y: 0 }}
            aria-label="文件管理"
            aria-modal="true"
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[#f8f8f8] text-gray-950 shadow-[0_-24px_80px_rgba(0,0,0,0.18)] dark:bg-[#0e0f11] dark:text-gray-50"
            exit={{ y: "100%" }}
            initial={{ y: "100%" }}
            role="dialog"
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="relative shrink-0 border-b border-gray-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111214]/90 sm:px-6">
              <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 pr-11 sm:h-[72px]">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold sm:text-lg">文件管理</h2>
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    管理已上传的附件
                  </p>
                </div>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-gray-950 px-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 sm:h-10 sm:px-4"
                  disabled={Boolean(upload)}
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  {upload ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                  <span className="hidden sm:inline">上传文件</span>
                  <span className="sm:hidden">上传</span>
                </button>
              </div>
              <IconButton
                className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 bg-transparent hover:bg-gray-100 dark:bg-transparent dark:hover:bg-white/[0.08] sm:right-5 sm:h-10 sm:w-10"
                onClick={onClose}
                title="关闭文件管理"
              >
                <X size={19} />
              </IconButton>
            </header>

            <input
              accept={ACCEPTED_FILES}
              className="hidden"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                void uploadFiles(files);
              }}
              ref={inputRef}
              type="file"
            />

            <main
              className="min-h-0 flex-1 overflow-y-auto"
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setDragActive(false);
              }}
              onDrop={(event: DragEvent<HTMLElement>) => {
                event.preventDefault();
                setDragActive(false);
                void uploadFiles(Array.from(event.dataTransfer.files));
              }}
            >
              <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
                <section className="grid shrink-0 grid-cols-2 border-y border-gray-200 bg-white dark:border-white/[0.08] dark:bg-[#111214] sm:grid-cols-[1fr_1fr_1.4fr]">
                  <div className="flex items-center gap-3 border-r border-gray-200 px-4 py-4 dark:border-white/[0.08] sm:px-5">
                    <Files className="hidden text-gray-400 sm:block" size={20} />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">文件</p>
                      <p className="mt-1 text-sm font-semibold">
                        {data?.usage.count ?? "-"}
                        <span className="font-normal text-gray-400">
                          {" "}
                          / {data?.limits.maxFileCount ?? "不限"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-4 sm:border-r sm:border-gray-200 sm:px-5 dark:sm:border-white/[0.08]">
                    <HardDrive className="hidden text-gray-400 sm:block" size={20} />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">存储空间</p>
                      <p className="mt-1 truncate text-sm font-semibold">
                        {data ? formatBytes(data.usage.size) : "-"}
                        <span className="font-normal text-gray-400">
                          {" "}
                          /{" "}
                          {data?.limits.maxStorageBytes
                            ? formatBytes(data.limits.maxStorageBytes)
                            : "不限"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-4 border-t border-gray-200 px-4 py-3 dark:border-white/[0.08] sm:col-span-1 sm:border-t-0 sm:px-5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-[width] duration-500 dark:bg-blue-500"
                        style={{
                          width: data?.limits.maxStorageBytes
                            ? `${Math.max(storagePercentage, data.usage.size > 0 ? 1 : 0)}%`
                            : "0%",
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      单个最大 {data ? formatBytes(data.limits.maxFileBytes) : "-"}
                    </span>
                  </div>
                </section>

                {upload && (
                  <div className="mt-4 flex items-center gap-3 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                    <LoaderCircle className="shrink-0 animate-spin" size={18} />
                    <p className="min-w-0 flex-1 truncate">正在上传 {upload.current}</p>
                    <span className="shrink-0 text-xs tabular-nums opacity-70">
                      {upload.completed + 1} / {upload.total}
                    </span>
                  </div>
                )}

                <div className="mt-6 flex shrink-0 items-center gap-3">
                  <div className="relative min-w-0 flex-1 sm:max-w-sm">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      aria-label="搜索文件"
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 dark:border-white/10 dark:bg-[#17181a] dark:focus:border-white/30"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索文件"
                      value={query}
                    />
                    {query && (
                      <button
                        aria-label="清除搜索"
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                        onClick={() => setQuery("")}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <p className="hidden text-xs text-gray-400 sm:block">
                    支持图片、文档、表格、演示文稿
                  </p>
                </div>

                <section className="mt-4 min-h-[260px] flex-1 border-t border-gray-200 dark:border-white/[0.08]">
                  {!data && !error && (
                    <div className="flex min-h-[320px] items-center justify-center text-gray-400">
                      <LoaderCircle className="animate-spin" size={22} />
                    </div>
                  )}

                  {error && !data && (
                    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                      <AlertCircle className="text-red-500" size={25} />
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{error}</p>
                      <button
                        className="mt-4 h-9 rounded-lg border border-gray-200 px-3 text-sm hover:bg-white dark:border-white/10 dark:hover:bg-white/[0.06]"
                        onClick={() => void loadFiles()}
                        type="button"
                      >
                        重新加载
                      </button>
                    </div>
                  )}

                  {data && visibleFiles.length === 0 && (
                    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/[0.06]">
                        {query ? <Search size={21} /> : <UploadCloud size={22} />}
                      </div>
                      <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {query ? "没有匹配的文件" : "还没有上传文件"}
                      </p>
                      {!query && (
                        <p className="mt-1.5 text-xs text-gray-400">上传后可在对话中继续使用</p>
                      )}
                    </div>
                  )}

                  {visibleFiles.map((file) => (
                    <ManagedFileRow file={file} key={file.id} onDelete={setDeletingFile} />
                  ))}
                </section>
              </div>

              <AnimatePresence>
                {dragActive && (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="pointer-events-none fixed inset-4 z-[75] flex items-center justify-center border-2 border-dashed border-blue-500 bg-blue-50/90 backdrop-blur-sm dark:bg-[#101827]/95"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                  >
                    <UploadCloud className="text-blue-600 dark:text-blue-400" size={32} />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </motion.section>

          <ConfirmDialog
            confirmText="删除"
            description={`“${deletingFile?.name || "该文件"}”将被永久删除，历史对话中的附件也将无法下载。`}
            loading={deleting}
            onCancel={() => setDeletingFile(null)}
            onConfirm={() => void handleDelete()}
            open={Boolean(deletingFile)}
            title="删除这个文件？"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
