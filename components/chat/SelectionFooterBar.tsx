'use client';

import { Copy, Trash2, X } from 'lucide-react';

export function SelectionFooterBar({
  onCopy,
  onDelete,
  onExit,
  selectedCount,
}: {
  onCopy: () => void;
  onDelete: () => void;
  onExit: () => void;
  selectedCount: number;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex animate-in slide-in-from-bottom-3 fade-in justify-center border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-12px_32px_rgba(0,0,0,0.08)] backdrop-blur-md duration-200 dark:border-white/10 dark:bg-[var(--chat-panel-bg)]/95 md:px-8">
      <div className="relative flex w-full max-w-[840px] items-center justify-center gap-4">
        <span className="absolute left-0 text-sm text-gray-500 dark:text-gray-400">已选择 {selectedCount} 条消息</span>
        <div className="flex items-center gap-1">
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onExit}
            type="button"
          >
            <X size={16} />
            取消
          </button>
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            disabled={selectedCount === 0}
            onClick={onCopy}
            type="button"
          >
            <Copy size={16} />
            复制
          </button>
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            disabled={selectedCount === 0}
            onClick={onDelete}
            type="button"
          >
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
