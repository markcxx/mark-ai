'use client';

import { createPortal } from 'react-dom';

export function ConfirmDialog({
  cancelText = '取消',
  confirmText = '确认',
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelText?: string;
  confirmText?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#191919]">
        <h3 className="text-base font-semibold text-gray-950 dark:text-gray-50">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="h-9 rounded-lg px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            onClick={onCancel}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className="h-9 rounded-lg bg-red-600 px-3 text-sm text-white transition-colors hover:bg-red-700"
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
