import { and, eq } from 'drizzle-orm';

import { decryptCredential } from './credential-crypto';
import { getDb } from './db';
import { userModelProviders } from './db/schema';
import type { ConfiguredModel, ModelRuntime, PublicConfiguredModel } from './models';

export type PublicUserModelProvider = {
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  id: string;
  isCustom: boolean;
  models: string[];
  name: string;
  provider: string;
  runtime: ModelRuntime;
};

const normalizeRuntime = (runtime: string): ModelRuntime =>
  runtime === 'gemini' ? 'gemini' : 'openai-compatible';

export const listUserModelProviders = async (userId: string): Promise<PublicUserModelProvider[]> => {
  const rows = await getDb()
    .select()
    .from(userModelProviders)
    .where(eq(userModelProviders.userId, userId));

  return rows.map((row) => ({
    baseUrl: row.baseUrl,
    enabled: row.enabled,
    hasApiKey: Boolean(row.apiKeyEncrypted),
    id: row.id,
    isCustom: row.isCustom,
    models: Array.isArray(row.models) ? row.models : [],
    name: row.name,
    provider: row.provider,
    runtime: normalizeRuntime(row.runtime),
  }));
};

export const getUserConfiguredModels = async (userId: string): Promise<ConfiguredModel[]> => {
  const rows = await getDb()
    .select()
    .from(userModelProviders)
    .where(and(eq(userModelProviders.userId, userId), eq(userModelProviders.enabled, true)));

  return rows.flatMap((row) => {
    if (!row.apiKeyEncrypted) return [];

    let apiKey = '';
    try {
      apiKey = decryptCredential(row.apiKeyEncrypted);
    } catch (error) {
      console.error(`Failed to decrypt provider ${row.provider}:`, error);
      return [];
    }

    return (Array.isArray(row.models) ? row.models : []).map((id) => ({
      apiKey,
      baseUrl: row.baseUrl,
      id,
      provider: row.provider,
      runtime: normalizeRuntime(row.runtime),
    }));
  });
};

export const getPublicUserModels = async (userId: string): Promise<PublicConfiguredModel[]> =>
  (await listUserModelProviders(userId))
    .filter((provider) => provider.enabled && provider.hasApiKey)
    .flatMap((provider) => provider.models.map((id) => ({ id, provider: provider.provider })));
