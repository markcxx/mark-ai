import { expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { createSettingsBackup, parseSettingsBackup } from "./backup";
it("round trips preferences without accepting unrelated secrets or fields", () => {
  const backup = createSettingsBackup({
    ...DEFAULT_SETTINGS,
    general: { ...DEFAULT_SETTINGS.general, chatFontSize: 18 },
    apiKey: "secret",
  } as typeof DEFAULT_SETTINGS);
  const text = JSON.stringify(backup);
  expect(text).not.toContain("secret");
  expect(parseSettingsBackup(text).general.chatFontSize).toBe(18);
  expect(parseSettingsBackup(text).speech).toEqual(DEFAULT_SETTINGS.speech);
});
it("rejects wrong apps, unsupported versions and malformed sections before applying anything", () => {
  for (const value of [
    null,
    {},
    { app: "Other", version: 1, settings: DEFAULT_SETTINGS },
    { app: "MarkAI", version: 2, settings: DEFAULT_SETTINGS },
    { app: "MarkAI", version: 1, settings: { ...DEFAULT_SETTINGS, general: [] } },
  ])
    expect(() => parseSettingsBackup(JSON.stringify(value))).toThrow();
  expect(() => parseSettingsBackup("{")).toThrow("JSON");
  expect(() => parseSettingsBackup(" ".repeat(300000))).toThrow("256 KB");
});
it("sanitizes imported values to the application's supported ranges", () => {
  const backup = createSettingsBackup(DEFAULT_SETTINGS);
  expect(
    parseSettingsBackup(
      JSON.stringify({
        ...backup,
        settings: {
          ...backup.settings,
          general: { ...backup.settings.general, chatFontSize: 900, themeMode: "invented" },
        },
      }),
    ).general,
  ).toMatchObject({ chatFontSize: 20, themeMode: "system" });
});
