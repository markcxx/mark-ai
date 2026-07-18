import * as echarts from "echarts";
import "echarts-gl";

import { ECHARTS_THEME_PALETTES } from "@/lib/visualization/echarts-theme-palettes";

const registeredThemes = new Set<string>();

export const ensureEChartsTheme = async (theme?: string) => {
  if (!theme || theme === "dark" || registeredThemes.has(theme)) return;
  const palette = ECHARTS_THEME_PALETTES[theme];
  if (!palette) return;
  const dark = theme.startsWith("dark-");
  echarts.registerTheme(theme, {
    backgroundColor: dark ? "#333333" : theme === "vintage" ? "#fef8ef" : "#ffffff",
    color: [...palette],
    darkMode: dark,
    legend: dark ? { textStyle: { color: "#d6d6d6" } } : undefined,
    textStyle: dark ? { color: "#d6d6d6" } : undefined,
    title: dark ? { textStyle: { color: "#f3f3f3" } } : undefined,
  });
  registeredThemes.add(theme);
};

export { echarts };
