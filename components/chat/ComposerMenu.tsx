"use client";

import { Atom, Check, ChevronRight, Globe, Paperclip, Plus, Store, Wrench } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import toast from "react-hot-toast";

import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { ConfiguredModel } from "@/lib/chat/types";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { resolveThinkingEnabled } from "@/lib/model-thinking";
import type { BuiltinToolCatalogItem } from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";

const rowClassName =
  "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-white/[0.06] dark:focus-visible:bg-white/[0.06] md:min-h-9";

function MenuRow({
  active,
  children,
  disabled,
  hint,
  icon,
  onClick,
  trailing,
  ...props
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  hint?: string;
  icon: ReactNode;
  onClick: () => void;
  trailing?: ReactNode;
  role?: string;
  "aria-checked"?: boolean;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "menu";
}) {
  return (
    <button
      className={cn(rowClassName, active && "bg-gray-100 dark:bg-white/[0.06]")}
      data-markai-tooltip={hint}
      disabled={disabled}
      onClick={onClick}
      type="button"
      {...props}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-500 dark:text-gray-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

/**
 * Single "+" entry for composer capabilities: attachments, web search, deep
 * thinking, and per-session tools. Active capabilities show as removable chips
 * next to the button so the current state stays visible without opening the menu.
 */
export function ComposerMenu({
  attachmentDisabled,
  disabled,
  model,
  onAttachment,
  onToggleWebSearch,
  webSearchEnabled,
}: {
  attachmentDisabled: boolean;
  disabled: boolean;
  model?: ConfiguredModel;
  onAttachment: () => void;
  onToggleWebSearch: () => void;
  webSearchEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [menuBottom, setMenuBottom] = useState(52);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const thinkingMode = useSettingsStore((state) => state.general.thinkingMode);
  const updateGeneral = useSettingsStore((state) => state.updateGeneral);
  const catalog = useToolStore((state) => state.catalog);
  const enabledToolIds = useToolStore((state) => state.enabledToolIds);
  const isCatalogLoading = useToolStore((state) => state.isCatalogLoading);
  const isSessionToolsLoading = useToolStore((state) => state.isSessionToolsLoading);
  const loadCatalog = useToolStore((state) => state.loadCatalog);
  const toggleTool = useToolStore((state) => state.toggleTool);

  const imageModel = isImageGenerationModel(model?.id);
  const thinkingEnabled = resolveThinkingEnabled(model?.thinking, thinkingMode);
  const installedTools = catalog.filter((tool) => tool.installed && tool.status === "available");
  const enabledTools = installedTools.filter((tool) => enabledToolIds.includes(tool.id));
  const toolsUnavailable = disabled || imageModel;
  const toolsCloseTimer = useRef<number | undefined>(undefined);
  const canHover = () => window.matchMedia("(hover: hover) and (min-width: 640px)").matches;
  const cancelToolsClose = () => window.clearTimeout(toolsCloseTimer.current);
  // Short grace period so the pointer can travel from the row into the flyout.
  const scheduleToolsClose = () => {
    if (!canHover()) return;
    cancelToolsClose();
    toolsCloseTimer.current = window.setTimeout(() => setToolsOpen(false), 220);
  };
  useEffect(() => () => window.clearTimeout(toolsCloseTimer.current), []);

  useEffect(() => {
    void loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  useEffect(() => {
    if (!open) {
      setToolsOpen(false);
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (toolsOpen) setToolsOpen(false);
      else setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, toolsOpen]);

  // Keep the menu above the button and inside the visual viewport (mobile keyboards).
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = rootRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const menuHeight = menuRef.current?.offsetHeight || 220;
      const desired = viewportHeight - anchor.top + 8;
      const max = Math.max(12, viewportHeight - Math.min(menuHeight, viewportHeight - 24) - 12);
      setMenuBottom(Math.max(12, Math.min(desired, max)));
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [open, toolsOpen]);

  const chipClassName =
    "group/chip flex h-9 min-w-0 max-w-[140px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-primary transition-colors hover:bg-primary/[0.06] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[0.06] md:h-8";

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <div className="relative" ref={rootRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="添加内容与功能"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.07] dark:hover:text-gray-100 md:h-9 md:w-9",
            open && "bg-gray-100 text-gray-800 dark:bg-white/[0.07] dark:text-gray-100",
          )}
          data-markai-tooltip="添加内容与功能"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <Plus
            className={cn("transition-transform duration-200", open && "rotate-45")}
            size={20}
          />
        </button>

        {open && (
          <div
            className="fixed inset-x-3 bottom-[var(--composer-menu-bottom)] z-50 origin-bottom-left animate-[menu-in_150ms_cubic-bezier(0.22,1,0.36,1)] rounded-xl border border-gray-200 bg-[var(--chat-popover-bg)] p-1.5 shadow-[0_18px_60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)] sm:absolute sm:inset-x-auto sm:bottom-12 sm:left-0 sm:w-64"
            ref={menuRef}
            role="menu"
            style={{ "--composer-menu-bottom": `${menuBottom}px` } as CSSProperties}
          >
            {toolsOpen && (
              // Desktop: flyout beside the main menu. Mobile: replaces it in place.
              <div
                className="absolute inset-0 z-10 animate-[menu-in_120ms_cubic-bezier(0.22,1,0.36,1)] rounded-xl bg-[var(--chat-popover-bg)] p-1.5 sm:inset-auto sm:bottom-[-7px] sm:left-[calc(100%+6px)] sm:w-64 sm:border sm:border-gray-200 sm:shadow-[0_18px_60px_rgba(15,23,42,0.18)] sm:dark:border-white/10 sm:dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
                onMouseEnter={cancelToolsClose}
                onMouseLeave={scheduleToolsClose}
                role="menu"
                aria-label="本会话工具"
              >
                <ToolsPanel
                  enabledToolIds={enabledToolIds}
                  installedTools={installedTools}
                  loading={isCatalogLoading || isSessionToolsLoading}
                  onBack={() => setToolsOpen(false)}
                  onOpenStore={() => {
                    setOpen(false);
                    useUIStore.getState().setPluginCenterOpen(true);
                  }}
                  onToggle={(toolId) =>
                    void toggleTool(toolId).catch(() => toast.error("更新工具状态失败"))
                  }
                />
              </div>
            )}
            <MenuRow
                  disabled={attachmentDisabled}
                  icon={<Paperclip size={17} />}
                  onClick={() => {
                    setOpen(false);
                    onAttachment();
                  }}
                  trailing={<span className="text-[11px] text-gray-400">最多 4 个</span>}
                >
                  {imageModel ? "上传参考图片" : "添加图片和文件"}
                </MenuRow>
                <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-white/[0.07]" />
                <MenuRow
                  aria-checked={webSearchEnabled}
                  disabled={disabled || imageModel}
                  hint={imageModel ? "图片生成模型暂不支持联网搜索" : undefined}
                  icon={<Globe size={17} />}
                  onClick={onToggleWebSearch}
                  role="menuitemcheckbox"
                  trailing={<ToggleSwitch checked={webSearchEnabled && !imageModel} />}
                >
                  联网搜索
                </MenuRow>
                {thinkingEnabled !== undefined && (
                  <MenuRow
                    aria-checked={thinkingEnabled}
                    disabled={disabled}
                    icon={<Atom size={17} />}
                    onClick={() =>
                      updateGeneral({ thinkingMode: thinkingEnabled ? "disabled" : "enabled" })
                    }
                    role="menuitemcheckbox"
                    trailing={<ToggleSwitch checked={thinkingEnabled} />}
                  >
                    深度思考
                  </MenuRow>
                )}
                <div
                  onMouseEnter={() => {
                    if (toolsUnavailable || !canHover()) return;
                    cancelToolsClose();
                    setToolsOpen(true);
                  }}
                  onMouseLeave={scheduleToolsClose}
                >
                  <MenuRow
                    active={toolsOpen}
                    aria-expanded={toolsOpen}
                    aria-haspopup="menu"
                    disabled={toolsUnavailable}
                    hint={imageModel ? "图片生成模型暂不支持工具" : undefined}
                    icon={<Wrench size={17} />}
                    onClick={() => setToolsOpen((value) => !value)}
                    trailing={
                      <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                        {enabledTools.length > 0 && `已启用 ${enabledTools.length}`}
                        <ChevronRight size={15} />
                      </span>
                    }
                  >
                    工具
                  </MenuRow>
                </div>
          </div>
        )}
      </div>

      {/* Active capabilities stay visible as compact chips; clicking one turns it off. */}
      {webSearchEnabled && !imageModel && (
        <button
          aria-label="关闭联网搜索"
          className={chipClassName}
          data-markai-tooltip="关闭联网搜索"
          disabled={disabled}
          onClick={onToggleWebSearch}
          type="button"
        >
          <Globe className="shrink-0" size={16} />
          <span className="hidden truncate sm:inline">联网</span>
        </button>
      )}
      {thinkingEnabled && (
        <button
          aria-label="关闭深度思考"
          className={chipClassName}
          data-markai-tooltip="关闭深度思考"
          disabled={disabled}
          onClick={() => updateGeneral({ thinkingMode: "disabled" })}
          type="button"
        >
          <Atom className="shrink-0" size={16} />
          <span className="hidden truncate sm:inline">思考</span>
        </button>
      )}
      {enabledTools.length > 0 && !imageModel && (
        <button
          aria-label={`已启用 ${enabledTools.length} 个工具`}
          className={chipClassName}
          data-markai-tooltip={enabledTools.map((tool) => tool.name).join("、")}
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            setToolsOpen(true);
          }}
          type="button"
        >
          <Wrench className="shrink-0" size={15} />
          <span className="truncate">
            {enabledTools.length === 1 ? enabledTools[0].shortName : `${enabledTools.length} 个工具`}
          </span>
        </button>
      )}
    </div>
  );
}

function ToolsPanel({
  enabledToolIds,
  installedTools,
  loading,
  onBack,
  onOpenStore,
  onToggle,
}: {
  enabledToolIds: string[];
  installedTools: BuiltinToolCatalogItem[];
  loading: boolean;
  onBack: () => void;
  onOpenStore: () => void;
  onToggle: (toolId: string) => void;
}) {
  return (
    <div>
      <button
        className="flex h-10 w-full items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06] sm:hidden"
        onClick={onBack}
        type="button"
      >
        <ChevronRight className="rotate-180" size={15} />
        返回
      </button>
      <p className="hidden px-2.5 pb-1 pt-1.5 text-xs text-gray-400 sm:block">本会话启用的工具</p>
      <div className="max-h-[min(44dvh,300px)] overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.05]"
                key={index}
              />
            ))}
          </div>
        ) : installedTools.length > 0 ? (
          installedTools.map((tool) => {
            const checked = enabledToolIds.includes(tool.id);
            return (
              <button
                aria-checked={checked}
                className={rowClassName}
                key={tool.id}
                onClick={() => onToggle(tool.id)}
                role="menuitemcheckbox"
                type="button"
              >
                <span className="min-w-0 flex-1 truncate">{tool.name}</span>
                <Check
                  aria-hidden="true"
                  className={cn("shrink-0 text-gray-900 dark:text-gray-100", !checked && "opacity-0")}
                  size={15}
                  strokeWidth={2.2}
                />
              </button>
            );
          })
        ) : (
          <p className="px-3 py-6 text-center text-xs leading-5 text-gray-400">
            还没有安装工具
            <br />
            去插件中心添加后即可在对话中启用
          </p>
        )}
      </div>
      <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-white/[0.07]" />
      <MenuRow
        icon={<Store size={16} />}
        onClick={onOpenStore}
        trailing={<ChevronRight className="text-gray-400" size={15} />}
      >
        插件中心
      </MenuRow>
    </div>
  );
}
