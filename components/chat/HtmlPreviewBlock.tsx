"use client";

import { Globe } from "lucide-react";

import { useHtmlPreview } from "./HtmlPreviewContext";
import { extractHtmlTitle, getHtmlPreviewId } from "./htmlPreviewUtils";

export function HtmlPreviewBlock({ children }: { children: string }) {
  const htmlPreview = useHtmlPreview();
  const id = getHtmlPreviewId(children);
  const title = extractHtmlTitle(children) || "网页预览";
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
      aria-label={`${active ? "关闭" : "打开"}网页预览：${title}`}
      aria-pressed={active}
      className="group my-4 flex w-full items-center gap-3 rounded-xl border border-gray-200/80 bg-[var(--chat-panel-bg)] p-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:border-white/10 dark:hover:bg-white/[0.03]"
      onClick={togglePreview}
      type="button"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-sky-400 dark:bg-white/[0.04]">
        <Globe size={21} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
          网站
        </span>
      </span>

    </button>
  );
}
