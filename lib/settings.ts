export type ThemeMode = "light" | "dark" | "system";
export type PrimaryColor =
  | "black"
  | "blue"
  | "cyan"
  | "green"
  | "indigo"
  | "magenta"
  | "orange"
  | "red"
  | "violet";
export type CodeTheme =
  | "dracula"
  | "duotone"
  | "github"
  | "gruvbox"
  | "material"
  | "night-owl"
  | "nord"
  | "one"
  | "solarized"
  | "vscode";
export type CodeColorMode = "auto" | "dark" | "light";
export type ThinkingDisplay = "auto" | "collapsed" | "expanded";
export type SendShortcut = "enter" | "mod-enter";

export type GeneralSettings = {
  autoScroll: boolean;
  chatFontSize: number;
  codeCollapseLines: number;
  codeColorMode: CodeColorMode;
  codeLineNumbers: boolean;
  codeTheme: CodeTheme;
  codeWrap: boolean;
  defaultWebSearch: boolean;
  density: "compact" | "comfortable" | "spacious";
  overwriteRegeneratedResponse: boolean;
  primaryColor: PrimaryColor;
  reduceMotion: boolean;
  responseAnimation: "none" | "fade" | "smooth";
  sendShortcut: SendShortcut;
  showMessageStats: boolean;
  sidebarWidth: number;
  themeMode: ThemeMode;
  thinkingDisplay: ThinkingDisplay;
  translationModelKey: string;
  wideChatMode: boolean;
};

export type LanguageModelSettings = {
  customInstructions: string;
  interests: string;
  occupation: string;
  personalizationEnabled: boolean;
  preferredName: string;
  responseLanguage: "auto" | "zh-CN" | "en-US";
  responseLength: "concise" | "balanced" | "detailed";
  responseTone: "direct" | "friendly" | "professional";
};

export type MarkAISettings = {
  general: GeneralSettings;
  languageModel: LanguageModelSettings;
};

export const PRIMARY_COLOR_VALUES: Record<PrimaryColor, string> = {
  black: "#111827",
  blue: "#2563eb",
  cyan: "#0891b2",
  green: "#16a34a",
  indigo: "#4f46e5",
  magenta: "#c026d3",
  orange: "#ea580c",
  red: "#dc2626",
  violet: "#7c3aed",
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  autoScroll: true,
  chatFontSize: 15,
  codeCollapseLines: 8,
  codeColorMode: "auto",
  codeLineNumbers: true,
  codeTheme: "one",
  codeWrap: false,
  defaultWebSearch: false,
  density: "comfortable",
  overwriteRegeneratedResponse: true,
  primaryColor: "black",
  reduceMotion: false,
  responseAnimation: "fade",
  sendShortcut: "enter",
  showMessageStats: true,
  sidebarWidth: 260,
  themeMode: "system",
  thinkingDisplay: "auto",
  translationModelKey: "__system__",
  wideChatMode: false,
};

export const DEFAULT_LANGUAGE_MODEL_SETTINGS: LanguageModelSettings = {
  customInstructions: "",
  interests: "",
  occupation: "",
  personalizationEnabled: false,
  preferredName: "",
  responseLanguage: "auto",
  responseLength: "balanced",
  responseTone: "friendly",
};

export const DEFAULT_SETTINGS: MarkAISettings = {
  general: DEFAULT_GENERAL_SETTINGS,
  languageModel: DEFAULT_LANGUAGE_MODEL_SETTINGS,
};

const stringOption = <T extends string>(value: unknown, options: readonly T[], fallback: T) =>
  typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
const numberInRange = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};
const booleanValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;
const shortText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const sanitizeGeneralSettings = (
  value: unknown,
  fallback = DEFAULT_GENERAL_SETTINGS,
): GeneralSettings => {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    autoScroll: booleanValue(input.autoScroll, fallback.autoScroll),
    chatFontSize: numberInRange(input.chatFontSize, fallback.chatFontSize, 12, 20),
    codeCollapseLines: numberInRange(input.codeCollapseLines, fallback.codeCollapseLines, 0, 100),
    codeColorMode: stringOption(
      input.codeColorMode,
      ["auto", "light", "dark"],
      fallback.codeColorMode,
    ),
    codeLineNumbers: booleanValue(input.codeLineNumbers, fallback.codeLineNumbers),
    codeTheme: stringOption(
      input.codeTheme,
      [
        "one",
        "vscode",
        "material",
        "gruvbox",
        "solarized",
        "github",
        "dracula",
        "night-owl",
        "nord",
        "duotone",
      ],
      fallback.codeTheme,
    ),
    codeWrap: booleanValue(input.codeWrap, fallback.codeWrap),
    defaultWebSearch: booleanValue(input.defaultWebSearch, fallback.defaultWebSearch),
    density: stringOption(input.density, ["compact", "comfortable", "spacious"], fallback.density),
    overwriteRegeneratedResponse: booleanValue(
      input.overwriteRegeneratedResponse,
      fallback.overwriteRegeneratedResponse,
    ),
    primaryColor: stringOption(
      input.primaryColor,
      ["black", "blue", "indigo", "violet", "magenta", "red", "orange", "green", "cyan"],
      fallback.primaryColor,
    ),
    reduceMotion: booleanValue(input.reduceMotion, fallback.reduceMotion),
    responseAnimation: stringOption(
      input.responseAnimation,
      ["none", "fade", "smooth"],
      fallback.responseAnimation,
    ),
    sendShortcut: stringOption(input.sendShortcut, ["enter", "mod-enter"], fallback.sendShortcut),
    showMessageStats: booleanValue(input.showMessageStats, fallback.showMessageStats),
    sidebarWidth: numberInRange(input.sidebarWidth, fallback.sidebarWidth, 220, 380),
    themeMode: stringOption(input.themeMode, ["light", "dark", "system"], fallback.themeMode),
    thinkingDisplay: stringOption(
      input.thinkingDisplay,
      ["auto", "collapsed", "expanded"],
      fallback.thinkingDisplay,
    ),
    translationModelKey: shortText(input.translationModelKey, 256),
    wideChatMode: booleanValue(input.wideChatMode, fallback.wideChatMode),
  };
};

export const sanitizeLanguageModelSettings = (
  value: unknown,
  fallback = DEFAULT_LANGUAGE_MODEL_SETTINGS,
): LanguageModelSettings => {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    customInstructions: shortText(input.customInstructions, 4000),
    interests: shortText(input.interests, 500),
    occupation: shortText(input.occupation, 120),
    personalizationEnabled: booleanValue(
      input.personalizationEnabled,
      fallback.personalizationEnabled,
    ),
    preferredName: shortText(input.preferredName, 60),
    responseLanguage: stringOption(
      input.responseLanguage,
      ["auto", "zh-CN", "en-US"],
      fallback.responseLanguage,
    ),
    responseLength: stringOption(
      input.responseLength,
      ["concise", "balanced", "detailed"],
      fallback.responseLength,
    ),
    responseTone: stringOption(
      input.responseTone,
      ["direct", "friendly", "professional"],
      fallback.responseTone,
    ),
  };
};

export const mergeSettings = (
  current: MarkAISettings,
  patch: Partial<{ general: unknown; languageModel: unknown }>,
): MarkAISettings => ({
  general: sanitizeGeneralSettings(
    patch.general && typeof patch.general === "object"
      ? { ...current.general, ...patch.general }
      : current.general,
    current.general,
  ),
  languageModel: sanitizeLanguageModelSettings(
    patch.languageModel && typeof patch.languageModel === "object"
      ? { ...current.languageModel, ...patch.languageModel }
      : current.languageModel,
    current.languageModel,
  ),
});
