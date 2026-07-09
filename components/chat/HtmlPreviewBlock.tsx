'use client';

import { Code2, FileCode2, PanelRightOpen, X } from 'lucide-react';

import { useHtmlPreview } from './HtmlPreviewContext';
import { extractHtmlTitle, getHtmlPreviewId } from './htmlPreviewUtils';

export function HtmlPreviewBlock({ children }: { children: string }) {
  const htmlPreview = useHtmlPreview();
  const id = getHtmlPreviewId(children);
  const title = extractHtmlTitle(children) || 'HTML 预览';
  const lineCount = children.trim().split('\n').length;
  const active = htmlPreview?.activePreview?.id === id;

  const togglePreview = () => {
    if (active) {
      htmlPreview?.closePreview();
      return;
    }

    htmlPreview?.openPreview({ content: children, id, title });
  };

  return (
    <button
      className="group my-5 flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-[#f8f9fa] p-3 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-white dark:border-white/10 dark:bg-[#151515] dark:hover:border-white/25 dark:hover:bg-[#1b1b1b]"
      onClick={togglePreview}
      type="button"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors group-hover:text-primary dark:bg-white/[0.06] dark:text-gray-400">
        <FileCode2 size={21} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Code2 size={13} />
          HTML · {lineCount} 行 · {active ? '点击关闭右侧预览' : '点击打开右侧预览'}
        </span>
      </span>

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors group-hover:bg-gray-100 group-hover:text-gray-900 dark:group-hover:bg-white/[0.06] dark:group-hover:text-gray-100">
        {active ? <X size={16} /> : <PanelRightOpen size={16} />}
      </span>
    </button>
  );
}
