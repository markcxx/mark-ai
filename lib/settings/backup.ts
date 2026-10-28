import { DEFAULT_SETTINGS, mergeSettings, type MarkAISettings } from "@/lib/settings";
export function createSettingsBackup(settings: MarkAISettings) {
  return {
    app: "MarkAI",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: mergeSettings(DEFAULT_SETTINGS, settings),
  };
}
export function parseSettingsBackup(text: string): MarkAISettings {
  if (text.length > 256 * 1024) throw new Error("设置文件不能超过 256 KB");
  let value: ReturnType<typeof createSettingsBackup>;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("请选择有效的 JSON 设置文件");
  }
  if (
    !value ||
    value.app !== "MarkAI" ||
    value.version !== 1 ||
    !value.settings ||
    ![value.settings.general, value.settings.languageModel, value.settings.speech].every(
      (part) => part && typeof part === "object" && !Array.isArray(part),
    )
  )
    throw new Error("这不是支持的 MarkAI 设置备份");
  return mergeSettings(DEFAULT_SETTINGS, value.settings);
}
