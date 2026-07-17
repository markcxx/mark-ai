import { eq } from "drizzle-orm";

import { getDb } from "./db";
import { userSettings } from "./db/schema";
import {
  DEFAULT_SETTINGS,
  sanitizeGeneralSettings,
  sanitizeLanguageModelSettings,
} from "./settings";
import type { MarkAISettings } from "./settings";

export const getUserSettings = async (userId: string): Promise<MarkAISettings> => {
  const [row] = await getDb()
    .select({ general: userSettings.general, languageModel: userSettings.languageModel })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return {
    general: sanitizeGeneralSettings(row?.general),
    languageModel: sanitizeLanguageModelSettings(row?.languageModel),
  };
};

export const getSettingsOrDefaults = async (userId?: string) =>
  userId ? getUserSettings(userId) : DEFAULT_SETTINGS;
