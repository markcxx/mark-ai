import { normalizeModelRuntime, resolveModelRuntime } from "./model-runtime";
import { getPublicThinkingCapability } from "./model-thinking";
import { and, eq } from "drizzle-orm";

import { decryptCredential } from "./credential-crypto";
import { getDb } from "./db";
import { userModelProviders } from "./db/schema";
import type { ConfiguredModel, ModelRuntime, PublicConfiguredModel } from "./models";

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

const normalizeRuntime = normalizeModelRuntime;

export const listUserModelProviders = async (
  userId: string,
): Promise<PublicUserModelProvider[]> => {
  const rows = await getDb()
    .select()
    .from(userModelProviders)
    .where(eq(userModelProviders.userId, userId));

  return toPublicProviders(rows);
};

type ProviderRow = typeof userModelProviders.$inferSelect;
const toPublicProviders = (rows: ProviderRow[]): PublicUserModelProvider[] =>
  rows.map((row) => ({
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

const toConfiguredModels = (rows: ProviderRow[]): ConfiguredModel[] =>
  rows.flatMap((row) => {
    if (!row.enabled || !row.apiKeyEncrypted) return [];
    let apiKey = "";
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
      runtime: resolveModelRuntime({ id, baseUrl: row.baseUrl, runtime: row.runtime }),
    }));
  });

export const getUserConfiguredModels = async (userId: string): Promise<ConfiguredModel[]> => {
  const rows = await getDb()
    .select()
    .from(userModelProviders)
    .where(and(eq(userModelProviders.userId, userId), eq(userModelProviders.enabled, true)));
  return toConfiguredModels(rows);
};

/** Resolve configured models and provider overrides from one consistent database read. */
export const getUserModelConfiguration = async (userId: string) => {
  const rows = await getDb()
    .select()
    .from(userModelProviders)
    .where(eq(userModelProviders.userId, userId));
  return { models: toConfiguredModels(rows), providers: toPublicProviders(rows) };
};

export const getPublicUserModels = async (userId: string): Promise<PublicConfiguredModel[]> =>
  (await listUserModelProviders(userId))
    .filter((provider) => provider.enabled && provider.hasApiKey)
    .flatMap((provider) =>
      provider.models.map((id) => ({
        id,
        provider: provider.provider,
        thinking: getPublicThinkingCapability({ ...provider, id }),
      })),
    );
