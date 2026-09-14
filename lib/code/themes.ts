import { CODE_THEMES } from "@/lib/visualization/theme-catalog";

export const LEGACY_CODE_THEMES: Record<string, readonly [string, string]> = {
  one: ["one-light", "one-dark-pro"],
  vscode: ["light-plus", "dark-plus"],
  material: ["material-theme-lighter", "material-theme-darker"],
  gruvbox: ["gruvbox-light-medium", "gruvbox-dark-medium"],
  solarized: ["solarized-light", "solarized-dark"],
  github: ["github-light", "github-dark"],
  duotone: ["vitesse-light", "vitesse-dark"],
};

export function resolveCodeTheme(theme: string, dark: boolean): string {
  return (
    LEGACY_CODE_THEMES[theme]?.[dark ? 1 : 0] ||
    (CODE_THEMES.some((item) => item.id === theme) ? theme : dark ? "one-dark-pro" : "one-light")
  );
}
