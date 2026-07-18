"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, LayoutDashboard, ScrollText, UsersRound } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";

import { AuditPanel } from "@/components/admin/AuditPanel";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { WaitlistPanel } from "@/components/admin/WaitlistPanel";
import { SidebarNavItem } from "@/components/chat/SidebarNavItem";
import { PRIMARY_COLOR_VALUES } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

type AdminView = "audit" | "overview" | "users" | "waitlist";

const views = [
  { icon: LayoutDashboard, id: "overview" as const, label: "管理概览" },
  { icon: ClipboardList, id: "waitlist" as const, label: "等候名单" },
  { icon: UsersRound, id: "users" as const, label: "用户管理" },
  { icon: ScrollText, id: "audit" as const, label: "审计日志" },
];

export function AdminConsole() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const general = useSettingsStore((state) => state.general);
  const settingsLoaded = useSettingsStore((state) => state.isLoaded);
  const [view, setView] = useState<AdminView>("overview");
  const current = views.find((item) => item.id === view)!;

  useEffect(() => {
    if (!settingsLoaded) void useSettingsStore.getState().loadSettings();
  }, [settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const root = document.documentElement;
    root.style.setProperty("--color-primary", PRIMARY_COLOR_VALUES[general.primaryColor]);
    root.style.setProperty("--color-primary-container", PRIMARY_COLOR_VALUES[general.primaryColor]);
    root.dataset.density = general.density;
    root.dataset.reduceMotion = general.reduceMotion ? "true" : "false";
    setTheme(general.themeMode);
  }, [general, setTheme, settingsLoaded]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--chat-app-bg)] p-0 text-gray-900 dark:text-gray-100 md:p-2">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <aside className="hidden w-[260px] shrink-0 flex-col p-3 md:flex">
        <div className="mb-5 flex items-center gap-3 px-2 pt-1">
          <Image alt="MarkAI" className="h-8 w-8" height={32} src="/images/markai.svg" width={32} />
          <div>
            <h1 className="text-lg font-bold leading-tight">MarkAI</h1>
            <p className="text-xs text-gray-400">管理中心</p>
          </div>
        </div>
        <nav className="space-y-1">
          {views.map((item) => (
            <SidebarNavItem
              active={view === item.id}
              icon={item.icon}
              key={item.id}
              label={item.label}
              onClick={() => setView(item.id)}
            />
          ))}
        </nav>
        <button
          className="mt-auto flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-gray-500 hover:bg-[#f0f1f2] dark:hover:bg-gray-800/60"
          onClick={() => router.push("/")}
          type="button"
        >
          <ArrowLeft size={16} />
          返回聊天
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto border-0 bg-[var(--chat-panel-bg)] md:rounded-xl md:border md:border-[#e5e5e5] dark:md:border-gray-700">
        <header className="sticky top-0 z-20 bg-[var(--chat-header-bg)] px-4 py-4 backdrop-blur-md md:px-6">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-400 md:hidden">MarkAI 管理中心</p>
              <h2 className="text-xl font-bold md:text-2xl">{current.label}</h2>
            </div>
            <button
              className="rounded-lg px-3 py-2 text-sm hover:bg-gray-100 md:hidden dark:hover:bg-white/[0.07]"
              onClick={() => router.push("/")}
              type="button"
            >
              返回
            </button>
          </div>
          <div className="mx-auto mt-3 flex max-w-[1440px] gap-2 overflow-x-auto pb-1 md:hidden">
            {views.map((item) => (
              <button
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium",
                  view === item.id
                    ? "bg-primary text-white"
                    : "bg-white text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
                )}
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] p-4 md:p-8">
          {view === "overview" && <OverviewPanel />}
          {view === "waitlist" && <WaitlistPanel />}
          {view === "users" && <UsersPanel />}
          {view === "audit" && <AuditPanel />}
        </div>
      </main>
    </div>
  );
}
