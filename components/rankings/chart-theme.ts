import type { RankingVendor } from "@/lib/model-rankings";

export const vendorColor = (vendor: RankingVendor, dark: boolean) =>
  dark ? vendor.darkColor || vendor.color : vendor.color;

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Distinct hues for comparing a few models or indices side by side. */
export const SERIES_COLORS = ["#3b82f6", "#f97316", "#10b981", "#a855f7"];

export function chartTheme(dark: boolean) {
  const muted = dark ? "#9ca3af" : "#6b7280";
  const border = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  return {
    muted,
    border,
    text: dark ? "#e5e7eb" : "#374151",
    surface: dark ? "#111214" : "#ffffff",
    tooltip: {
      confine: true,
      padding: [8, 12],
      backgroundColor: dark ? "#191919" : "#ffffff",
      borderColor: border,
      borderWidth: 1,
      textStyle: { color: dark ? "#f3f4f6" : "#111827", fontSize: 12 },
    },
    axisLabel: { color: muted, fontSize: 10 },
    axisLine: { lineStyle: { color: border } },
    splitLine: { lineStyle: { color: border, type: "dashed" as const } },
  };
}
