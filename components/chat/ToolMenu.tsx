"use client";

import { ChevronRight, Loader2, Puzzle, Sparkles, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { cn } from "@/lib/utils";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";

export function ToolMenu({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const catalog = useToolStore((state) => state.catalog);
  const enabledToolIds = useToolStore((state) => state.enabledToolIds);
  const isCatalogLoading = useToolStore((state) => state.isCatalogLoading);
  const isSessionToolsLoading = useToolStore((state) => state.isSessionToolsLoading);
  const loadCatalog = useToolStore((state) => state.loadCatalog);
  const toggleTool = useToolStore((state) => state.toggleTool);
  const installedTools = catalog.filter((tool) => tool.installed && tool.status === "available");

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

  return (
    <div className="relative" ref={rootRef}>
      <button
        className={cn(
          "relative flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200",
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
        <div className="absolute bottom-12 left-0 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#171717] dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
          <div className="border-b border-gray-100 px-4 py-3.5 dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Sparkles className="text-primary" size={16} />
              当前会话工具
            </div>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              仅启用的工具会进入本次对话上下文
            </p>
          </div>

          <div className="max-h-[340px] overflow-y-auto p-2">
            {isCatalogLoading || isSessionToolsLoading ? (
              <div className="flex h-24 items-center justify-center text-gray-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : installedTools.length > 0 ? (
              installedTools.map((tool) => {
                const checked = enabledToolIds.includes(tool.id);
                return (
                  <div
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.05]"
                    key={tool.id}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        tool.accent === "blue" &&
                          "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
                        tool.accent === "emerald" &&
                          "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
                        tool.accent === "violet" &&
                          "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
                      )}
                    >
                      {tool.kind === "skill" ? <Sparkles size={19} /> : <Puzzle size={19} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {tool.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-400">
                        {tool.kind === "skill" ? "Skill" : "内置工具"} · v{tool.version}
                      </span>
                    </span>
                    <ToggleSwitch
                      checked={checked}
                      disabled={isSessionToolsLoading}
                      onChange={() => {
                        void toggleTool(tool.id).catch(() => toast.error("更新工具状态失败"));
                      }}
                    />
                  </div>
                );
              })
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
            className="flex w-full items-center justify-between border-t border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.04]"
            onClick={() => {
              setOpen(false);
              useUIStore.getState().setPluginCenterOpen(true);
            }}
            type="button"
          >
            前往插件中心
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
