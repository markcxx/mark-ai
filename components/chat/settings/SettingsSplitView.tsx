"use client";
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export function SettingsSplitView({
  sidebar,
  children,
  showDetail = false,
  sidebarWidth = 280,
  contentRef,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  showDetail?: boolean;
  sidebarWidth?: number;
  contentRef?: Ref<HTMLElement>;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col text-gray-900 dark:text-gray-100 md:flex-row">
      <aside
        className={cn(
          "max-h-60 w-full shrink-0 overflow-y-auto border-r border-gray-200/60 bg-white dark:border-white/[0.07] dark:bg-[#111214] md:max-h-none md:w-[var(--settings-detail-sidebar)]",
          showDetail && "hidden md:block",
        )}
        style={{ "--settings-detail-sidebar": `${sidebarWidth}px` } as CSSProperties}
      >
        {sidebar}
      </aside>
      <section ref={contentRef} className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto w-full max-w-[1024px]">{children}</div>
      </section>
    </div>
  );
}
