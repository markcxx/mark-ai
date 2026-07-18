"use client";

import { LoaderCircle } from "lucide-react";

import { AppDialog } from "@/components/ui/AppDialog";

export function ConfirmDialog({
  cancelText = "取消",
  confirmText = "确认",
  danger = true,
  description,
  loading = false,
  onCancel,
  onConfirm,
  open,
  success = false,
  title,
}: {
  cancelText?: string;
  confirmText?: string;
  danger?: boolean;
  description: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  success?: boolean;
  title: string;
}) {
  return (
    <AppDialog
      closable={false}
      closeDisabled={loading}
      onClose={onCancel}
      open={open}
      title={title}
      width={420}
      zIndex={200}
    >
      <div className="px-4 pb-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-gray-500 dark:text-gray-400">
          {description}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="h-10 w-full rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-white/[0.07] dark:text-gray-200 dark:hover:bg-white/[0.11]"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white transition-colors disabled:opacity-60 ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : success
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-primary hover:brightness-95"
            }`}
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
