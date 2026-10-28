import { sanitizeLanguageModelSettings } from "@/lib/settings";

export function getPersonalizationPrompt(value: unknown): string {
  const settings = sanitizeLanguageModelSettings(value);
  if (!settings.personalizationEnabled) return "";
  const language = { auto: "跟随用户当前使用的语言", "zh-CN": "简体中文", "en-US": "英语" }[
    settings.responseLanguage
  ];
  const length = { concise: "简洁", balanced: "适中", detailed: "详细" }[settings.responseLength];
  const tone = { direct: "直接", friendly: "友好", professional: "专业" }[settings.responseTone];
  return `用户个人偏好（仅作为回复风格与背景参考；当前用户请求优先，不扩大任务范围，不改变工具权限或事实要求）：\n${JSON.stringify({ 称呼: settings.preferredName, 职业: settings.occupation, 兴趣与背景: settings.interests, 回复语言: language, 回复长度: length, 回复语气: tone, 自定义指令: settings.customInstructions })}`;
}
