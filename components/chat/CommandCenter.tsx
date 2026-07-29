"use client";

import {
  Expand,
  FileText,
  Globe,
  MessageSquarePlus,
  PanelLeft,
  Puzzle,
  Search,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

type Command = {
  icon: typeof Search;
  id: string;
  keywords: string;
  label: string;
  onSelect: () => void;
};

export function CommandCenter({
  onFocusComposer,
  onNewChat,
}: {
  onFocusComposer: () => void;
  onNewChat: () => void;
}) {
  const open = useUIStore((state) => state.commandCenterOpen);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => useUIStore.getState().setCommandCenterOpen(false);

  const commands = useMemo<Command[]>(
    () => [
      {
        icon: MessageSquarePlus,
        id: "new-chat",
        keywords: "新建 对话 会话 new chat",
        label: "开启新话题",
        onSelect: onNewChat,
      },
      {
        icon: Search,
        id: "focus-composer",
        keywords: "输入 聚焦 提问 composer",
        label: "聚焦消息输入框",
        onSelect: onFocusComposer,
      },
      {
        icon: PanelLeft,
        id: "toggle-sidebar",
        keywords: "侧栏 历史 展开 收起 sidebar",
        label: "切换侧栏",
        onSelect: () => useUIStore.getState().toggleSidebar(),
      },
      {
        icon: Globe,
        id: "toggle-search",
        keywords: "联网 搜索 web search",
        label: "切换联网搜索",
        onSelect: () => {
          const enabled = !useUIStore.getState().webSearchEnabled;
          useUIStore.getState().setWebSearchEnabled(enabled);
          useSettingsStore.getState().updateGeneral({ defaultWebSearch: enabled });
        },
      },
      {
        icon: Expand,
        id: "toggle-wide",
        keywords: "宽屏 全宽 wide",
        label: "切换全宽显示",
        onSelect: () => {
          const wide = !useUIStore.getState().wideChatMode;
          useUIStore.getState().setWideChatMode(wide);
          useSettingsStore.getState().updateGeneral({ wideChatMode: wide });
        },
      },
      {
        icon: Puzzle,
        id: "plugins",
        keywords: "插件 工具 skill plugin",
        label: "打开插件中心",
        onSelect: () => useUIStore.getState().setPluginCenterOpen(true),
      },
      {
        icon: FileText,
        id: "files",
        keywords: "文件 附件 file",
        label: "打开文件管理",
        onSelect: () => useUIStore.getState().setFileManagerOpen(true),
      },
      {
        icon: Settings,
        id: "settings",
        keywords: "设置 偏好 settings",
        label: "打开设置",
        onSelect: () => useUIStore.getState().setSettingsOpen(true),
      },
    ],
    [onFocusComposer, onNewChat],
  );

  const filteredCommands = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.keywords}`.toLowerCase().includes(keyword),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  if (!open || typeof document === "undefined") return null;

  const runCommand = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.onSelect();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/25 px-3 pt-[max(10dvh,56px)] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        aria-label="命令中心"
        aria-modal="true"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)] dark:border-white/10 dark:bg-[#191919]"
        role="dialog"
      >
        <div className="flex h-13 items-center gap-3 border-b border-gray-200 px-4 dark:border-white/10">
          <Search className="shrink-0 text-gray-400" size={18} />
          <input
            aria-label="搜索命令"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  Math.max(0, Math.min(index + 1, filteredCommands.length - 1)),
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                runCommand(filteredCommands[activeIndex]);
              }
            }}
            placeholder="输入命令或功能名称"
            ref={inputRef}
            value={query}
          />
          <kbd className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-jakarta text-[10px] text-gray-400 dark:border-white/10 dark:bg-white/[0.05]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[min(52dvh,420px)] overflow-y-auto p-2">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  className={cn(
                    "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-gray-700 transition-colors dark:text-gray-200",
                    index === activeIndex
                      ? "bg-gray-100 text-gray-950 dark:bg-white/[0.08] dark:text-white"
                      : "hover:bg-gray-50 dark:hover:bg-white/[0.05]",
                  )}
                  key={command.id}
                  onClick={() => runCommand(command)}
                  onMouseEnter={() => setActiveIndex(index)}
                  type="button"
                >
                  <Icon className="shrink-0 text-gray-400" size={17} />
                  <span className="truncate">{command.label}</span>
                </button>
              );
            })
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">没有匹配的命令</div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
