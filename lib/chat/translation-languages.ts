export const TRANSLATION_LANGUAGES = [
  { label: "简体中文", value: "zh-CN" },
  { label: "繁体中文", value: "zh-TW" },
  { label: "English", value: "en" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Español", value: "es" },
  { label: "Русский", value: "ru" },
] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number]["value"];

export const getTranslationLanguageLabel = (value: string) =>
  TRANSLATION_LANGUAGES.find((language) => language.value === value)?.label;
