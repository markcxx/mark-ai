"use client";

import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { setGuestMode } from "@/lib/client/guest-mode";
import { useSessionStore } from "@/stores/useSessionStore";
import { useAppliedSettings } from "@/hooks/useAppliedSettings";
import { FileManagerDrawer } from "./FileManagerDrawer";
import { IconButton } from "@/components/ui/IconButton";
import { AppInput } from "@/components/ui/AppInput";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  SETTINGS_SEARCH,
  type SettingsSection,
} from "./settings/settings-sections";
import { SettingsSkeleton } from "./settings/SettingsPrimitives";

const ProfileSettings = dynamic(
  () => import("./settings/ProfileSettings").then((m) => m.ProfileSettings),
  { loading: SettingsSkeleton },
);
const PersonalizationSettings = dynamic(
  () => import("./settings/ProfileSettings").then((m) => m.PersonalizationSettings),
  { loading: SettingsSkeleton },
);
const AppearanceSettings = dynamic(
  () => import("./settings/GeneralSettingsSections").then((m) => m.AppearanceSettings),
  { loading: SettingsSkeleton },
);
const ChatSettings = dynamic(
  () => import("./settings/GeneralSettingsSections").then((m) => m.ChatSettings),
  { loading: SettingsSkeleton },
);
const SpeechSettings = dynamic(
  () => import("./settings/GeneralSettingsSections").then((m) => m.SpeechSettings),
  { loading: SettingsSkeleton },
);
const HotkeySettings = dynamic(
  () => import("./settings/GeneralSettingsSections").then((m) => m.HotkeySettings),
  { loading: SettingsSkeleton },
);
const ServiceModelSettings = dynamic(
  () => import("./settings/GeneralSettingsSections").then((m) => m.ServiceModelSettings),
  { loading: SettingsSkeleton },
);
const ProviderSettings = dynamic(
  () => import("./settings/ProviderSettings").then((m) => m.ProviderSettings),
  { loading: SettingsSkeleton },
);
const UsageSettings = dynamic(
  () => import("./settings/UsageSettings").then((m) => m.UsageSettings),
  { loading: SettingsSkeleton },
);
const SubscriptionSettings = dynamic(
  () => import("./settings/SubscriptionSettings").then((m) => m.SubscriptionSettings),
  { loading: SettingsSkeleton },
);
const StorageSettings = dynamic(
  () => import("./settings/StorageSettings").then((m) => m.StorageSettings),
  { loading: SettingsSkeleton },
);
const SecuritySettings = dynamic(
  () => import("./settings/SecuritySettings").then((m) => m.SecuritySettings),
  { loading: SettingsSkeleton },
);
const SkillsSettings = dynamic(
  () => import("./settings/SkillsSettings").then((m) => m.SkillsSettings),
  { loading: SettingsSkeleton },
);
const AdvancedSettings = dynamic(
  () => import("./settings/SystemSettings").then((m) => m.AdvancedSettings),
  { loading: SettingsSkeleton },
);
const AboutSettings = dynamic(
  () => import("./settings/SystemSettings").then((m) => m.AboutSettings),
  { loading: SettingsSkeleton },
);
const UnavailableSettings = dynamic(
  () => import("./settings/SystemSettings").then((m) => m.UnavailableSettings),
  { loading: SettingsSkeleton },
);

export function SettingsWorkspace({ section }: { section: SettingsSection }) {
  setGuestMode(false);
  useAppliedSettings();
  const router = useRouter();
  const fileManagerOpen = useUIStore((s) => s.fileManagerOpen);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  useEffect(() => {
    if (!useSettingsStore.getState().isLoaded) void useSettingsStore.getState().loadSettings();
    void useUIStore.getState().loadModels();
  }, []);
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const content = useRef<HTMLDivElement>(null);
  const saveState = useSettingsStore((s) => s.saveState);
  const current = SETTINGS_SECTIONS.find((item) => item.id === section)!;
  const matches = SETTINGS_SEARCH(query);
  const close = () => {
    const sessionId = useSessionStore.getState().activeSessionId;
    router.push(sessionId ? `/${sessionId}` : "/");
  };
  const select = (id: SettingsSection) => {
    router.push(`/settings/${id}`, { scroll: false });
    setMobileNav(false);
    setQuery("");
    content.current?.scrollTo({ top: 0 });
  };
  const openFiles = () => useUIStore.getState().setFileManagerOpen(true);
  const syncSettings = [
    "appearance",
    "hotkey",
    "chat",
    "service-model",
    "personalization",
    "speech",
    "advanced",
  ].includes(section);
  const renderPage = () => {
    switch (section) {
      case "profile":
        return <ProfileSettings onSecurity={() => select("security")} />;
      case "appearance":
        return <AppearanceSettings />;
      case "hotkey":
        return <HotkeySettings />;
      case "security":
        return <SecuritySettings />;
      case "statistics":
        return <UsageSettings />;
      case "usage":
        return <UsageSettings detail />;
      case "plans":
      case "billing":
      case "credits":
      case "referral":
        return <SubscriptionSettings section={section} />;
      case "providers":
        return <ProviderSettings />;
      case "service-model":
        return <ServiceModelSettings />;
      case "chat":
        return <ChatSettings />;
      case "personalization":
        return <PersonalizationSettings />;
      case "speech":
        return <SpeechSettings />;
      case "skills":
        return <SkillsSettings />;
      case "storage":
        return <StorageSettings onOpenFiles={openFiles} />;
      case "advanced":
        return <AdvancedSettings />;
      case "about":
        return <AboutSettings />;
      case "trash":
      case "apikey":
      case "oauth-apps":
      case "labs":
        return <UnavailableSettings section={section} />;
    }
  };
  return (
    <>
      <Toaster position="top-center" />
      <div className="markai-settings-workspace flex h-dvh min-w-0 bg-[var(--chat-app-bg)] text-gray-900 dark:text-gray-100 md:gap-1 md:p-2 md:pl-0">
        <aside
          className={cn(
            "w-full shrink-0 flex-col bg-[var(--chat-app-bg)] md:w-[236px]",
            sidebarCollapsed ? "md:hidden" : "md:flex",
            mobileNav ? "flex" : "hidden",
          )}
        >
          <div className="flex h-9 shrink-0 items-center gap-1 px-2">
            <IconButton
              aria-label="返回对话"
              data-markai-tooltip="返回对话"
              onClick={close}
              size="sm"
            >
              <Home size={15} />
            </IconButton>
            <ChevronRight size={12} className="text-gray-400" />
            <span className="flex-1 text-sm text-gray-500">设置</span>
            <IconButton
              aria-label="搜索设置"
              data-markai-tooltip="搜索设置"
              onClick={() => setSearchOpen((v) => !v)}
              size="sm"
            >
              <Search size={15} />
            </IconButton>
            <IconButton
              className="hidden md:inline-flex"
              aria-label="收起设置导航"
              data-markai-tooltip="收起设置导航"
              onClick={() => setSidebarCollapsed(true)}
              size="sm"
            >
              <PanelLeftClose size={15} />
            </IconButton>
          </div>
          {(searchOpen || query) && (
            <div className="relative mx-2 my-2">
              <Search
                aria-hidden="true"
                size={15}
                className="pointer-events-none absolute left-3 top-2.5 text-gray-400"
              />
              <AppInput
                aria-label="搜索设置"
                placeholder="搜索设置…"
                className="h-9 border-transparent bg-gray-100/70 pl-9 text-sm dark:bg-white/[0.04]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}
          <nav
            aria-label="设置分类"
            className="markai-scrollbar-auto-hide min-h-0 flex-1 overflow-y-auto px-1 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
          >
            {SETTINGS_GROUPS.map((group, groupIndex) => {
              const items = group.items.filter((item) =>
                matches.some((match) => match.id === item.id),
              );
              if (!items.length) return null;
              const expanded =
                groupIndex === 0 || Boolean(query) || !collapsed.includes(group.label);
              return (
                <div key={group.label} className="mb-2">
                  {groupIndex !== 0 && (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className="flex min-h-10 w-full items-center gap-1 px-2 text-left text-xs font-medium text-gray-400 sm:min-h-7"
                      onClick={() =>
                        setCollapsed((value) =>
                          value.includes(group.label)
                            ? value.filter((item) => item !== group.label)
                            : [...value, group.label],
                        )
                      }
                    >
                      {group.label}
                      {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                  )}
                  {expanded && (
                    <div className="space-y-px">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-current={section === item.id ? "page" : undefined}
                          onClick={() => select(item.id)}
                          className={cn(
                            "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg px-1 text-left text-sm transition-colors md:min-h-9",
                            section === item.id
                              ? "bg-black/[0.04] text-gray-950 dark:bg-white/10 dark:text-white"
                              : "text-gray-500 hover:bg-black/[0.025] dark:text-gray-400 dark:hover:bg-white/[0.05]",
                          )}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center">
                            <item.icon aria-hidden="true" size={18} />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!matches.length && <p className="p-3 text-xs text-gray-500">没有找到相关设置</p>}
          </nav>
          <button
            onClick={() => select("plans")}
            className="mx-2 mb-2 flex min-h-12 shrink-0 items-center justify-between gap-2 rounded-xl bg-black/[0.035] px-3 text-left text-xs dark:bg-white/[0.045]"
          >
            <span>升级以解锁更多能力</span>
            <span className="text-blue-600 dark:text-blue-400">查看套餐</span>
          </button>
        </aside>
        <main
          className={cn(
            "relative min-w-0 flex-1 flex-col overflow-hidden bg-[var(--chat-panel-bg)] md:rounded-lg md:border md:border-black/10 dark:md:border-white/10",
            mobileNav ? "hidden md:flex" : "flex",
          )}
        >
          <header
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 px-2",
              ["providers", "skills"].includes(section) && !sidebarCollapsed && "md:hidden",
            )}
          >
            {sidebarCollapsed && (
              <IconButton
                className="hidden md:inline-flex"
                aria-label="展开设置导航"
                data-markai-tooltip="展开设置导航"
                onClick={() => setSidebarCollapsed(false)}
                size="sm"
              >
                <PanelLeftOpen size={16} />
              </IconButton>
            )}
            <IconButton
              className="md:hidden"
              aria-label="打开设置导航"
              data-markai-tooltip="设置导航"
              onClick={() => setMobileNav(true)}
              shape="rounded"
            >
              <Menu size={19} />
            </IconButton>
            <h2 className="min-w-0 flex-1 truncate text-center text-sm font-medium">
              {current.label}
            </h2>
            {syncSettings && (
              <span
                role="status"
                className={cn(
                  "hidden text-xs sm:block",
                  saveState === "error" ? "text-red-500" : "text-gray-400",
                )}
              >
                {saveState === "error"
                  ? "同步失败 · 本地已生效"
                  : saveState === "saving"
                    ? "正在保存…"
                    : "自动保存"}
              </span>
            )}
            <IconButton
              aria-label="关闭设置"
              data-markai-tooltip="关闭设置"
              onClick={close}
              shape="rounded"
              size="sm"
            >
              <X size={19} />
            </IconButton>
          </header>
          <div
            ref={content}
            className={cn(
              "min-h-0 flex-1",
              ["providers", "skills"].includes(section) ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            {!settingsLoaded ? (
              <SettingsSkeleton />
            ) : ["providers", "skills"].includes(section) ? (
              renderPage()
            ) : (
              <div className="mx-auto w-full max-w-[1072px] px-4 pb-[max(128px,env(safe-area-inset-bottom))] pt-6 md:px-6">
                <div key={section}>{renderPage()}</div>
              </div>
            )}
          </div>
        </main>
      </div>
      {fileManagerOpen && (
        <FileManagerDrawer open onClose={() => useUIStore.getState().setFileManagerOpen(false)} />
      )}
    </>
  );
}
