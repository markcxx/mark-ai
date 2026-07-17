"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const updateGeneral = useSettingsStore((state) => state.updateGeneral);
  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <button
      className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
      onClick={() => {
        setTheme(nextTheme);
        updateGeneral({ themeMode: nextTheme });
      }}
      suppressHydrationWarning
      title={isDark ? "切换到亮色模式" : "切换到暗色模式"}
      type="button"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
