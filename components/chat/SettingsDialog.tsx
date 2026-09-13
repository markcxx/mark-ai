"use client";

import {
  AudioLines,
  KeyRound,
  Palette,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";

import { AppDialog } from "@/components/ui/AppDialog";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSettingsStore } from "@/stores/useSettingsStore";

import { ProviderSettings } from "./settings/ProviderSettings";
import { SidebarNavItem } from "./SidebarNavItem";
import {
  AppearanceSettings,
  ChatSettings,
  SpeechSettings,
} from "./settings/GeneralSettingsSections";

type SettingsSection = "appearance" | "chat" | "providers" | "speech";
const sections: Array<{ id: SettingsSection; icon: typeof Palette; label: string }> = [
  { id: "appearance", icon: Palette, label: "外观" },
  { id: "chat", icon: SlidersHorizontal, label: "对话" },
  { id: "speech", icon: AudioLines, label: "语音" },
  { id: "providers", icon: KeyRound, label: "AI 提供商" },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const saveState = useSettingsStore((state) => state.saveState);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const current = sections.find((item) => item.id === section)!;

  return (
    <>
      <AppDialog
        bodyClassName="h-full"
        closable={false}
        height="100dvh"
        onClose={close}
        onOpenChangeComplete={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        open={open}
        wrapperClassName="markai-settings-drawer-viewport"
        panelClassName="markai-settings-drawer"
        title={false}
        width="100vw"
        zIndex={100}
      >
        <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#151515]">
          <aside className="relative hidden w-56 shrink-0 border-r border-gray-100 bg-gray-50/70 p-3 dark:border-white/[0.07] dark:bg-white/[0.02] sm:block">
            <div className="flex h-12 items-center gap-2 px-3 text-sm font-semibold">
              <Settings2 size={18} />
              设置
            </div>
            <nav className="mt-2 flex flex-col gap-1">
              {sections.map(({ id, icon, label }) => (
                <SidebarNavItem
                  active={section === id}
                  icon={icon}
                  key={id}
                  label={label}
                  onClick={() => setSection(id)}
                />
              ))}
            </nav>
            <button
              className="absolute bottom-5 flex items-center gap-2 px-3 text-xs text-gray-400 hover:text-red-500"
              onClick={() => setResetConfirmOpen(true)}
              type="button"
            >
              <RotateCcw size={14} />
              恢复默认
            </button>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-5 dark:border-white/[0.07]">
              <div>
                <h2 className="font-semibold text-gray-950 dark:text-white">{current.label}</h2>
                <div className="mt-0.5 text-xs text-gray-400">
                  {section === "providers"
                    ? "管理模型服务与个人配置"
                    : saveState === "error"
                      ? "云端同步失败，本地设置已经生效"
                      : saveState === "saving"
                        ? "正在恢复默认设置…"
                        : saveState === "saved"
                          ? "已应用 · 自动保存"
                          : "修改会立即应用并自动保存"}
                </div>
              </div>
              <button
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.07]"
                aria-label="关闭设置"
                data-markai-tooltip="关闭设置"
                onClick={close}
                type="button"
              >
                <X size={20} />
              </button>
            </header>
            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2 dark:border-white/[0.07] sm:hidden">
              {sections.map((item) => (
                <button
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm",
                    section === item.id
                      ? "bg-gray-100 font-medium dark:bg-white/10"
                      : "text-gray-500",
                  )}
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div
              className={cn(
                "min-h-0 flex-1",
                section === "providers" ? "overflow-hidden" : "overflow-y-auto px-5 sm:px-8",
              )}
            >
              {section === "appearance" && <AppearanceSettings />}
              {section === "chat" && <ChatSettings />}
              {section === "speech" && <SpeechSettings />}
              {section === "providers" && <ProviderSettings />}
            </div>
          </main>
        </div>
      </AppDialog>
      <ConfirmDialog
        confirmText="恢复默认"
        description="外观、对话和语音设置会恢复为初始值，此操作会立即应用。"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => {
          setResetConfirmOpen(false);
          void resetSettings();
        }}
        open={resetConfirmOpen}
        title="恢复全部默认设置？"
      />
    </>
  );
}
