"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Puzzle, Search } from "lucide-react";
import toast from "react-hot-toast";
import { AppInput } from "@/components/ui/AppInput";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";
import { SettingsSplitView } from "./SettingsSplitView";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { BuiltinToolCatalogItem } from "@/lib/tools/types";
import { useToolStore } from "@/stores/useToolStore";
import {
  SettingsButton,
  SettingsEmpty,
  SettingsError,
  SettingsGroup,
  SettingsSkeleton,
} from "./SettingsPrimitives";
export function SkillsSettings() {
  const catalog = useToolStore((s) => s.catalog);
  const loading = useToolStore((s) => s.isCatalogLoading);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BuiltinToolCatalogItem | null>(null);
  const load = () => {
    setError("");
    void useToolStore
      .getState()
      .loadCatalog()
      .catch(() => setError("技能列表加载失败，请重试"));
  };
  useEffect(load, []);
  const mutate = async (tool: BuiltinToolCatalogItem, uninstall: boolean) => {
    setPending(tool.id);
    try {
      await useToolStore.getState()[uninstall ? "uninstallTool" : "installTool"](tool.id);
      toast.success(uninstall ? "已卸载" : "已安装，可在对话中启用");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setPending(null);
    }
  };
  if (error) return <SettingsError message={error} onRetry={load} />;
  if (loading) return <SettingsSkeleton />;
  const visible = catalog.filter((tool) =>
    `${tool.name} ${tool.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const active = catalog.find((tool) => tool.id === selected);
  const action = (tool: BuiltinToolCatalogItem) => (
    <SettingsButton
      disabled={Boolean(pending) || tool.status !== "available"}
      onClick={() => (tool.installed ? setRemoving(tool) : void mutate(tool, false))}
    >
      {pending === tool.id
        ? "处理中…"
        : tool.status !== "available"
          ? "未开放"
          : tool.installed
            ? "卸载"
            : "安装"}
    </SettingsButton>
  );
  return (
    <>
      <SettingsSplitView
        sidebarWidth={300}
        showDetail={Boolean(active)}
        sidebar={
          <>
            <div className="sticky top-0 z-10 border-b border-gray-200/60 bg-white p-3 dark:border-white/10 dark:bg-[#111214]">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-3 text-gray-400" />
                <AppInput
                  className="pl-9 text-sm"
                  aria-label="搜索技能"
                  placeholder="搜索技能…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <nav className="space-y-1 p-2" aria-label="技能列表">
              {[true, false].map((installed) => (
                <div key={String(installed)}>
                  <p className="px-2 py-3 text-xs text-gray-400">
                    {installed ? "已安装" : "可安装"}
                  </p>
                  {visible
                    .filter((t) => t.installed === installed)
                    .map((tool) => (
                      <button
                        key={tool.id}
                        aria-current={active?.id === tool.id ? "page" : undefined}
                        onClick={() => setSelected(tool.id)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5 md:min-h-9",
                          active?.id === tool.id && "bg-gray-100 dark:bg-white/[0.07]",
                        )}
                      >
                        <Puzzle size={18} className="shrink-0 text-gray-400" />
                        <span className="truncate">{tool.name}</span>
                      </button>
                    ))}
                </div>
              ))}
              {!visible.length && <p className="p-4 text-xs text-gray-400">没有匹配的技能</p>}
            </nav>
          </>
        }
      >
        {active ? (
          <>
            <header className="mb-6 flex flex-wrap items-start gap-3 border-b border-gray-200 pb-5 dark:border-white/10">
              <IconButton
                className="md:hidden"
                aria-label="返回技能列表"
                data-markai-tooltip="返回技能列表"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft size={18} />
              </IconButton>
              <Puzzle size={32} className="shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">{active.name}</h3>
                <p className="mt-1 text-xs text-gray-400">
                  MarkAI · v{active.version} · {active.kind === "skill" ? "技能" : "工具"}
                </p>
                <p className="mt-3 text-sm leading-6 text-gray-500">{active.description}</p>
              </div>
              {action(active)}
            </header>
            <SettingsGroup title="简介">
              <ul className="list-inside list-disc space-y-3 py-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {active.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </SettingsGroup>
            <SettingsGroup
              title="提供的能力"
              description="启用后，模型可根据任务需要调用这些能力。"
            >
              {active.functions.map((fn) => (
                <div
                  key={fn.name}
                  className="border-b border-gray-100 py-4 last:border-0 dark:border-white/10"
                >
                  <p className="break-all font-mono text-sm">{fn.name}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{fn.description}</p>
                </div>
              ))}
            </SettingsGroup>
          </>
        ) : (
          <>
            <h3 className="mb-2 text-2xl font-semibold">技能与工具</h3>
            <p className="mb-6 text-sm leading-6 text-gray-500">
              扩展 MarkAI 的任务能力。安装后，在对话中选择启用。
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((tool) => (
                <article
                  key={tool.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-white/10"
                >
                  <button className="w-full text-left" onClick={() => setSelected(tool.id)}>
                    <span className="flex items-center gap-2 text-base font-medium">
                      <Puzzle size={20} />
                      {tool.name}
                    </span>
                    <p className="mt-3 line-clamp-2 min-h-11 text-sm leading-[22px] text-gray-500">
                      {tool.description}
                    </p>
                  </button>
                  <div className="mt-4 flex justify-end border-t border-gray-100 pt-3 dark:border-white/10">
                    {action(tool)}
                  </div>
                </article>
              ))}
            </div>
            {!catalog.length && (
              <SettingsEmpty title="暂无可用技能" description="站点开放的技能会在这里显示。" />
            )}
          </>
        )}
      </SettingsSplitView>
      <ConfirmDialog
        open={Boolean(removing)}
        title={`卸载 ${removing?.name || "技能"}？`}
        description="卸载后，该工具会从已启用的会话中移除。"
        confirmText="卸载"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) void mutate(removing, true);
          setRemoving(null);
        }}
      />
    </>
  );
}
