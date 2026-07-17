"use client";

import { LoaderCircle } from "lucide-react";

import { AppDialog } from "@/components/ui/AppDialog";

export function ConfirmDialog({
  cancelText = "取消",
  confirmText = "确认",
  description,
  loading = false,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelText?: string;
  confirmText?: string;
  description: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <AppDialog
      closable={false}
      closeDisabled={loading}
      onClose={onCancel}
      open={open}
      title={title}
      width={384}
      zIndex={200}
    >
      <div className="px-4 pb-4">
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="h-9 rounded-lg px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading && <LoaderCircle className="animate-spin" size={15} />}
            {confirmText}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
