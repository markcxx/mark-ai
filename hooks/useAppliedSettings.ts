"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { PRIMARY_COLOR_VALUES } from "@/lib/settings";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

export function useAppliedSettings() {
  const { setTheme } = useTheme();
  const generalSettings = useSettingsStore((s) => s.general);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  useEffect(() => {
    if (!settingsLoaded) return;
    const root = document.documentElement;
    root.dataset.primaryColor = generalSettings.primaryColor;
    if (generalSettings.primaryColor === "black") {
      root.style.removeProperty("--color-primary");
      root.style.removeProperty("--color-primary-container");
    } else {
      root.style.setProperty("--color-primary", PRIMARY_COLOR_VALUES[generalSettings.primaryColor]);
      root.style.setProperty(
        "--color-primary-container",
        PRIMARY_COLOR_VALUES[generalSettings.primaryColor],
      );
    }
    root.style.setProperty("--chat-font-size", `${generalSettings.chatFontSize}px`);
    root.dataset.density = generalSettings.density;
    root.dataset.reduceMotion = generalSettings.reduceMotion ? "true" : "false";
    setTheme(generalSettings.themeMode);
    useUIStore.getState().setWebSearchEnabled(generalSettings.defaultWebSearch);
    useUIStore.getState().setWideChatMode(generalSettings.wideChatMode);
    useUIStore.getState().setSidebarWidth(generalSettings.sidebarWidth);
    useUIStore.getState().setPreviewWidth(generalSettings.previewWidth);
  }, [generalSettings, setTheme, settingsLoaded]);
}
