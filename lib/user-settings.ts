import { eq } from "drizzle-orm";

import { getDb } from "./db";
import { userSettings } from "./db/schema";
import {
  DEFAULT_SETTINGS,
  sanitizeGeneralSettings,
  sanitizeLanguageModelSettings,
  sanitizeSpeechSettings,
} from "./settings";
import type { MarkAISettings } from "./settings";

export const getUserSettings = async (userId: string): Promise<MarkAISettings> => {
  const [row] = await getDb()
    .select({
      general: userSettings.general,
      languageModel: userSettings.languageModel,
      speech: userSettings.speech,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return {
    general: sanitizeGeneralSettings(row?.general),
    languageModel: sanitizeLanguageModelSettings(row?.languageModel),
    speech: sanitizeSpeechSettings(row?.speech),
  };
};

export const getSettingsOrDefaults = async (userId?: string) =>
  userId ? getUserSettings(userId) : DEFAULT_SETTINGS;
