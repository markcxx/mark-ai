"use client";

import { ChevronDown, CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export const toolPreviewActionClass =
  "flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-white/[0.07] dark:hover:text-gray-200";

export function ToolPreviewCard({
  actions,
  badge,
  children,
  defaultOpen = true,
  icon: Icon,
  title,
}: {
  actions?: ReactNode;
  badge: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon: LucideIcon;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className="my-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]"
      data-markai-tool-preview={badge.toLowerCase()}
    >
      <header
        className={cn(
          "flex min-h-12 flex-wrap items-center justify-between gap-2 px-3 py-1.5",
          open && "border-b border-gray-100 dark:border-white/[0.08]",
        )}
      >
        <button
          aria-expanded={open}
          aria-label={open ? `收起${title}` : `展开${title}`}
          className="flex min-w-[140px] flex-1 items-center gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          data-markai-tooltip={open ? "收起" : "展开"}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <Icon className="shrink-0 text-primary" size={17} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </span>
          <span className="hidden shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline dark:bg-white/[0.06]">
            {badge}
          </span>
          <ChevronDown
            className={cn(
              "shrink-0 text-gray-400 transition-transform duration-200",
              !open && "-rotate-90",
            )}
            size={15}
          />
        </button>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      {open && children}
    </section>
  );
}

export function ToolPreviewError({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-start gap-3 bg-gray-50/70 px-4 py-5 dark:bg-white/[0.025]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
        <CircleAlert size={17} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}暂时无法展示</p>
        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
          模型返回的内容可能不完整。请重新生成此回复，或复制源码后检查格式。
        </p>
      </div>
    </div>
  );
}
