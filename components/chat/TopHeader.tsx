'use client';

import { MoreVertical, PanelLeftOpen, Share2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function TopHeader({
  copyConversation,
  isSidebarOpen,
  onMore,
  onOpenSidebar,
}: {
  copyConversation: () => void;
  isSidebarOpen: boolean;
  onMore: () => void;
  onOpenSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between bg-white/80 dark:bg-gray-900/80 px-6 backdrop-blur-md">
      <div className="flex items-center">
        {!isSidebarOpen && (
          <button
            className="mr-2 flex h-10 w-10 items-center justify-center rounded-full text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={onOpenSidebar}
            title="展开侧栏"
            type="button"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        <h2 className="px-3 text-base font-semibold text-gray-900 dark:text-gray-100">对话</h2>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          onClick={copyConversation}
          title="复制对话"
          type="button"
        >
          <Share2 size={20} />
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          onClick={onMore}
          title="更多"
          type="button"
        >
          <MoreVertical size={20} />
        </button>
      </div>
    </header>
  );
}
