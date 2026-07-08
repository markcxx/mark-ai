'use client';

import { HelpCircle, PanelLeftClose, Plus, Puzzle, Settings } from 'lucide-react';

import { NOT_IMPLEMENTED_TOAST } from '@/lib/chat/constants';
import { cn } from '@/lib/utils';

export function Sidebar({
  isOpen,
  isResizing,
  onClose,
  onNewChat,
  onUnavailable,
  width,
}: {
  isOpen: boolean;
  isResizing: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onUnavailable: (message?: string) => void;
  width: number;
}) {
  return (
    <aside
      className={cn(
        'z-30 flex h-full shrink-0 flex-col bg-[#f8f8f8]',
        !isResizing && 'transition-[width,margin] duration-200 ease-out',
        isOpen ? 'mr-2' : 'mr-0 w-0 overflow-hidden',
      )}
      style={isOpen ? { width } : undefined}
    >
      <div className="flex h-full flex-col" style={{ width }}>
        <div className="mb-2 flex items-center justify-between p-3">
          <div className="ml-2 mt-1 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
              <span className="text-lg font-bold">M</span>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-gray-900">MarkAI</h1>
              <p className="font-jakarta text-xs text-gray-500">Intelligent Clarity</p>
            </div>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200"
            onClick={onClose}
            title="收起侧栏"
            type="button"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="mb-6 mt-2 px-4">
          <button
            className="group flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[#f3f4f5] px-4 py-2 text-sm font-medium text-gray-900 transition-all hover:bg-white hover:shadow-sm"
            onClick={onNewChat}
            type="button"
          >
            <Plus size={20} />
            <span>新建会话</span>
            <span className="ml-auto text-xs text-gray-400 transition-colors group-hover:text-gray-500">
              ⌘K
            </span>
          </button>
        </div>

        <div className="mb-4 px-3">
          <div className="mb-2 px-3 font-jakarta text-xs font-semibold uppercase tracking-wider text-gray-400">
            视图
          </div>
          <nav className="flex flex-col gap-1">
            <button
              className="flex items-center gap-3 rounded-lg bg-gray-200 px-3 py-2 font-medium text-gray-900 transition-colors"
              onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
              type="button"
            >
              <Puzzle size={20} />
              <span className="text-sm">插件中心</span>
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-2 mt-4 px-3 font-jakarta text-xs font-semibold uppercase tracking-wider text-gray-400">
            今天
          </div>
          <div className="flex flex-col gap-1">
            {['Markdown 翻译工具', 'PyQt5 按钮点击事件处理', '设计系统 Token 梳理'].map((item, index) => (
              <button
                className={cn(
                  'flex items-center gap-3 truncate rounded-lg px-3 py-2 text-sm transition-colors',
                  index === 0
                    ? 'border border-gray-100 bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200',
                )}
                key={item}
                onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
                type="button"
              >
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>

          <div className="mb-2 mt-6 px-3 font-jakarta text-xs font-semibold uppercase tracking-wider text-gray-400">
            昨天
          </div>
          <div className="flex flex-col gap-1">
            {['TailwindCSS 网格布局求助', '分析 Q3 财报数据'].map((item) => (
              <button
                className="flex items-center gap-3 truncate rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200"
                key={item}
                onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
                type="button"
              >
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-gray-200/50 p-4">
          <nav className="flex flex-col gap-1">
            <button
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-600 transition-colors hover:bg-gray-200"
              onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
              type="button"
            >
              <Settings size={20} />
              <span className="text-sm">设置</span>
            </button>
            <button
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-600 transition-colors hover:bg-gray-200"
              onClick={() => onUnavailable(NOT_IMPLEMENTED_TOAST)}
              type="button"
            >
              <HelpCircle size={20} />
              <span className="text-sm">帮助</span>
            </button>
          </nav>
        </div>
      </div>
    </aside>
  );
}
