"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  LayoutDashboard,
  RefreshCw,
  ScrollText,
  UsersRound,
  Megaphone,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";

import { AuditPanel } from "@/components/admin/AuditPanel";
import { AnnouncementPanel } from "@/components/admin/AnnouncementPanel";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { WaitlistPanel } from "@/components/admin/WaitlistPanel";
import { SidebarNavItem } from "@/components/chat/SidebarNavItem";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { IconButton } from "@/components/ui/IconButton";
import { PRIMARY_COLOR_VALUES } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

type AdminView = "audit" | "overview" | "users" | "waitlist" | "announcement";

const views = [
  {
    description: "查看用户与系统运行情况",
    icon: LayoutDashboard,
    id: "overview" as const,
    label: "管理概览",
  },
  {
    description: "审核注册申请与邀请状态",
    icon: ClipboardList,
    id: "waitlist" as const,
    label: "等候名单",
  },
  {
    description: "管理账户、角色与使用状态",
    icon: UsersRound,
    id: "users" as const,
    label: "用户管理",
  },
  {
    description: "查看后台操作与安全记录",
    icon: ScrollText,
    id: "audit" as const,
    label: "审计日志",
  },
  {
    description: "编辑聊天页和下载页的公告文字",
    icon: Megaphone,
    id: "announcement" as const,
    label: "站点公告",
  },
];

export function AdminConsole() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const general = useSettingsStore((state) => state.general);
  const settingsLoaded = useSettingsStore((state) => state.isLoaded);
  const [view, setView] = useState<AdminView>("overview");
  const [overviewRangeDays, setOverviewRangeDays] = useState(14);
  const [overviewRefreshToken, setOverviewRefreshToken] = useState(0);
  const current = views.find((item) => item.id === view)!;

  useEffect(() => {
    if (!settingsLoaded) void useSettingsStore.getState().loadSettings();
  }, [settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const root = document.documentElement;
    root.dataset.primaryColor = general.primaryColor;
    if (general.primaryColor === "black") {
      root.style.removeProperty("--color-primary");
      root.style.removeProperty("--color-primary-container");
    } else {
      root.style.setProperty("--color-primary", PRIMARY_COLOR_VALUES[general.primaryColor]);
      root.style.setProperty(
        "--color-primary-container",
        PRIMARY_COLOR_VALUES[general.primaryColor],
      );
    }
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
        <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-[var(--chat-header-bg)] px-3 py-3 backdrop-blur-md md:px-6 dark:border-white/[0.07]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 md:hidden">MarkAI 管理中心</p>
              <h2 className="truncate text-[17px] font-semibold leading-6">{current.label}</h2>
              <p className="mt-0.5 hidden truncate text-xs text-gray-400 md:block">
                {current.description}
              </p>
            </div>
            {view === "overview" && (
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <SegmentedControl
                  onChange={(value) => setOverviewRangeDays(Number(value))}
                  options={[
                    { label: "7 天", value: 7 },
                    { label: "14 天", value: 14 },
                    { label: "30 天", value: 30 },
                  ]}
                  padding={3}
                  value={overviewRangeDays}
                />
                <IconButton
                  aria-label="刷新概览数据"
                  data-markai-tooltip="刷新概览数据"
                  onClick={() => setOverviewRefreshToken((value) => value + 1)}
                  shape="rounded"
                  size="sm"
                >
                  <RefreshCw size={16} />
                </IconButton>
              </div>
            )}
            <button
              className="rounded-lg px-3 py-2 text-sm hover:bg-gray-100 md:hidden dark:hover:bg-white/[0.07]"
              onClick={() => router.push("/")}
              type="button"
            >
              返回
            </button>
          </div>
          <div className="mx-auto mt-3 grid max-w-[1440px] grid-cols-5 gap-1 md:hidden">
            {views.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
                    view === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]",
                  )}
                  key={item.id}
                  onClick={() => setView(item.id)}
                  type="button"
                >
                  <Icon size={15} />
                  <span className="w-full truncate text-center">{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>
        <div
          className={cn(
            "mx-auto max-w-[1440px] px-3 py-4",
            view === "overview" ? "md:px-6 md:py-6" : "md:p-8",
          )}
        >
          {view === "overview" && (
            <OverviewPanel
              onRangeDaysChange={setOverviewRangeDays}
              rangeDays={overviewRangeDays}
              refreshToken={overviewRefreshToken}
            />
          )}
          {view === "waitlist" && <WaitlistPanel />}
          {view === "users" && <UsersPanel />}
          {view === "audit" && <AuditPanel />}
          {view === "announcement" && <AnnouncementPanel />}
        </div>
      </main>
    </div>
  );
}
