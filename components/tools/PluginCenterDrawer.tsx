"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ChartNoAxesCombined,
  FileText,
  Layers3,
  Loader2,
  ShieldCheck,
  Table2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

import { IconButton } from "@/components/ui/IconButton";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { BuiltinToolCatalogItem } from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { useToolStore } from "@/stores/useToolStore";

const iconMap = {
  "data-visualization": ChartNoAxesCombined,
  "excel-workbook": Table2,
  "word-document": FileText,
};

const accentStyles = {
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
};

function PluginCard({ tool }: { tool: BuiltinToolCatalogItem }) {
  const [working, setWorking] = useState(false);
  const installTool = useToolStore((state) => state.installTool);
  const uninstallTool = useToolStore((state) => state.uninstallTool);
  const Icon = iconMap[tool.id as keyof typeof iconMap] || Layers3;
  const planned = tool.status === "planned";

  const updateInstallation = async (installed: boolean) => {
    if (planned || working || installed === tool.installed) return;
    setWorking(true);
    try {
      if (installed) {
        await installTool(tool.id);
        toast.success(`${tool.shortName} 已添加到工具库`);
      } else {
        await uninstallTool(tool.id);
        toast.success(`${tool.shortName} 已移出工具库`);
      }
    } catch {
      toast.error(installed ? "添加失败，请稍后重试" : "移除失败，请稍后重试");
    } finally {
      setWorking(false);
    }
  };

  return (
    <article className="flex min-h-[176px] flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white transition-colors hover:border-gray-300 dark:border-white/[0.09] dark:bg-[#17181a] dark:hover:border-white/[0.16]">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                accentStyles[tool.accent],
              )}
            >
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                {tool.name}
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {tool.kind === "skill" ? "内置 Skill" : "内置插件"} · v{tool.version}
              </p>
            </div>
          </div>
          {planned && (
            <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
              规划中
            </span>
          )}
        </div>

        <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-gray-500 dark:text-gray-400">
          {tool.description}
        </p>

        <p className="truncate text-[11px] text-gray-400" title={tool.features.join(" · ")}>
          {tool.features.join(" · ")}
        </p>
      </div>

      <div className="mx-4 border-t border-gray-100 dark:border-white/[0.07]" />
      <div className="flex h-12 items-center justify-between px-4">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <ShieldCheck size={14} />
          MarkAI 官方
        </span>
        <div className="flex items-center gap-2">
          {working && <Loader2 className="animate-spin text-gray-400" size={14} />}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {planned ? "暂不可用" : tool.installed ? "已安装" : "未安装"}
          </span>
          <ToggleSwitch
            checked={tool.installed}
            disabled={planned || working}
            onChange={(installed) => void updateInstallation(installed)}
          />
        </div>
      </div>
    </article>
  );
}

export function PluginCenterDrawer({ onClose, open }: { onClose: () => void; open: boolean }) {
  const catalog = useToolStore((state) => state.catalog);
  const isLoading = useToolStore((state) => state.isCatalogLoading);
  const loadCatalog = useToolStore((state) => state.loadCatalog);
  const [category, setCategory] = useState<"all" | "creation" | "documents">("all");

  useEffect(() => {
    if (!open) return;
    void loadCatalog(true).catch(() => toast.error("加载插件中心失败"));
  }, [loadCatalog, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const filteredTools = useMemo(
    () => catalog.filter((tool) => category === "all" || tool.category === category),
    [catalog, category],
  );
  const installedCount = catalog.filter((tool) => tool.installed).length;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] bg-black/25"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.section
            animate={{ y: 0 }}
            aria-label="插件中心"
            aria-modal="true"
            className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[#f7f7f8] text-gray-950 shadow-[0_-24px_80px_rgba(0,0,0,0.18)] dark:bg-[#0e0f11] dark:text-gray-50"
            exit={{ y: "100%" }}
            initial={{ y: "100%" }}
            role="dialog"
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="relative shrink-0 border-b border-gray-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111214]/90 sm:px-6">
              <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 pr-11 sm:h-[72px]">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold sm:text-lg">插件中心</h2>
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    管理内置插件与 Skill
                  </p>
                </div>
                <div className="hidden items-center gap-2 text-xs text-gray-400 sm:flex">
                  <ShieldCheck size={15} />
                  {installedCount} 个已安装
                </div>
              </div>
              <IconButton
                className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 bg-transparent hover:bg-gray-100 dark:bg-transparent dark:hover:bg-white/[0.08] sm:right-5 sm:h-10 sm:w-10"
                onClick={onClose}
                title="关闭插件中心"
              >
                <X size={19} />
              </IconButton>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1 rounded-lg bg-gray-200/60 p-1 dark:bg-white/[0.06]">
                    {[
                      { id: "all" as const, label: "全部" },
                      { id: "documents" as const, label: "文件与文档" },
                      { id: "creation" as const, label: "创作与原型" },
                    ].map((item) => (
                      <button
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          category === item.id
                            ? "bg-white text-gray-900 shadow-sm dark:bg-white/[0.12] dark:text-white"
                            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                        )}
                        key={item.id}
                        onClick={() => setCategory(item.id)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">在具体对话中按需启用已安装工具</p>
                </div>

                {isLoading && catalog.length === 0 ? (
                  <div className="flex min-h-[280px] items-center justify-center text-gray-400">
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                ) : (
                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTools.map((tool) => (
                      <PluginCard key={tool.id} tool={tool} />
                    ))}
                  </section>
                )}
              </div>
            </main>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
