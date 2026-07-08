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
    <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center border-t border-gray-200 bg-white px-4 py-3 md:px-8">
      <div className="relative flex w-full max-w-[840px] items-center justify-center">
        <span className="absolute left-0 text-sm text-gray-500">已选择 {selectedCount} 条消息</span>
        <div className="flex items-center gap-1">
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100"
            onClick={onExit}
            type="button"
          >
            <X size={16} />
            取消
          </button>
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            disabled={selectedCount === 0}
            onClick={onCopy}
            type="button"
          >
            <Copy size={16} />
            复制
          </button>
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
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

