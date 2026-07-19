"use client";

import {
  BarChart3,
  Check,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Puzzle,
  Store,
  Wrench,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import toast from "react-hot-toast";

import type { BuiltinToolCatalogItem } from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";

export function ToolMenu({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mobileBottom, setMobileBottom] = useState(92);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const catalog = useToolStore((state) => state.catalog);
  const enabledToolIds = useToolStore((state) => state.enabledToolIds);
  const isCatalogLoading = useToolStore((state) => state.isCatalogLoading);
  const isSessionToolsLoading = useToolStore((state) => state.isSessionToolsLoading);
  const loadCatalog = useToolStore((state) => state.loadCatalog);
  const toggleTool = useToolStore((state) => state.toggleTool);
  const installedTools = catalog.filter((tool) => tool.installed && tool.status === "available");

  const getToolIcon = (tool: BuiltinToolCatalogItem) => {
    if (tool.id === "word-document") return FileText;
    if (tool.id === "excel-workbook") return FileSpreadsheet;
    if (tool.id === "data-visualization") return BarChart3;
    return Puzzle;
  };

  useEffect(() => {
    void loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = rootRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const menuHeight = menuRef.current?.offsetHeight || 260;
      const desiredBottom = viewportHeight - anchor.top + 8;
      const maxBottom = Math.max(
        12,
        viewportHeight - Math.min(menuHeight, viewportHeight - 24) - 12,
      );
      setMobileBottom(Math.max(12, Math.min(desiredBottom, maxBottom)));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        className={cn(
          "relative flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 md:h-9",
          open && "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
        )}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        title="当前会话工具"
        type="button"
      >
        <Wrench size={18} />
        <span className="hidden sm:inline">工具</span>
        {enabledToolIds.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
            {enabledToolIds.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-x-3 bottom-[var(--tool-menu-mobile-bottom)] z-50 origin-bottom-left animate-[menu-in_150ms_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_18px_60px_rgba(15,23,42,0.2)] sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:w-80 dark:border-white/10 dark:bg-[#191919] dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
          ref={menuRef}
          style={{ "--tool-menu-mobile-bottom": `${mobileBottom}px` } as CSSProperties}
        >
          <div className="max-h-[min(52dvh,360px)] overflow-y-auto overscroll-contain">
            {isCatalogLoading || isSessionToolsLoading ? (
              <div className="flex h-24 items-center justify-center text-gray-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : installedTools.length > 0 ? (
              <>
                <p className="px-2 pb-1 pt-1 text-xs text-gray-400">内置插件</p>
                <div className="space-y-0.5">
                  {installedTools.map((tool) => {
                    const checked = enabledToolIds.includes(tool.id);
                    const ToolIcon = getToolIcon(tool);
                    return (
                      <button
                        aria-checked={checked}
                        className={cn(
                          "flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-gray-100 active:bg-gray-200/70 dark:hover:bg-white/[0.06] dark:active:bg-white/[0.1]",
                          checked && "bg-gray-50 dark:bg-white/[0.035]",
                        )}
                        disabled={isSessionToolsLoading}
                        key={tool.id}
                        onClick={() => {
                          void toggleTool(tool.id).catch(() => toast.error("更新工具状态失败"));
                        }}
                        role="switch"
                        type="button"
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                            tool.accent === "blue" &&
                              "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
                            tool.accent === "emerald" &&
                              "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
                            tool.accent === "violet" &&
                              "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
                          )}
                        >
                          <ToolIcon size={15} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200">
                          {tool.name}
                        </span>
                        <span
                          className={cn(
                            "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                            checked
                              ? "border-primary bg-primary text-white"
                              : "border-gray-300 bg-white text-transparent dark:border-gray-600 dark:bg-transparent",
                          )}
                        >
                          <Check size={12} strokeWidth={2.8} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="px-2 pb-1 pt-3 text-xs text-gray-400">第三方插件</p>
              </>
            ) : (
              <div className="px-4 py-8 text-center">
                <Puzzle className="mx-auto text-gray-300 dark:text-gray-600" size={28} />
                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                  还没有安装工具
                </p>
                <p className="mt-1 text-xs text-gray-400">去插件中心添加内置工具</p>
              </div>
            )}
          </div>

          <button
            className="mt-1 flex h-10 w-full items-center gap-2 border-t border-gray-100 px-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.04]"
            onClick={() => {
              setOpen(false);
              useUIStore.getState().setPluginCenterOpen(true);
            }}
            type="button"
          >
            <Store className="text-gray-500" size={16} />
            插件商店
            <ChevronRight className="ml-auto text-gray-400" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
