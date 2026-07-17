import { getProviderDisplayName, getPublicConfiguredModels, findConfiguredModel } from "./models";
import type { ConfiguredModel, PublicConfiguredModel } from "./models";
import {
  getPublicUserModels,
  getUserConfiguredModels,
  listUserModelProviders,
} from "./user-model-providers";

const dedupePublicModels = (models: PublicConfiguredModel[]) => {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = `${model.provider}:${model.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getAvailablePublicModels = async (userId?: string) => {
  if (!userId) return getPublicConfiguredModels();

  const [userModels, userProviders] = await Promise.all([
    getPublicUserModels(userId),
    listUserModelProviders(userId),
  ]);
  const overriddenProviders = new Set(
    userProviders
      .filter((item) => item.enabled && item.hasApiKey && item.models.length > 0)
      .map((item) => item.provider),
  );
  const disabledProviders = new Set(
    userProviders.filter((item) => !item.enabled).map((item) => item.provider),
  );
  const siteModels = getPublicConfiguredModels().filter(
    (model) => !overriddenProviders.has(model.provider) && !disabledProviders.has(model.provider),
  );

  return dedupePublicModels([...userModels, ...siteModels]);
};

export const getAvailableProviderNames = async (userId?: string) => {
  const names: Record<string, string> = {};
  for (const model of getPublicConfiguredModels()) {
    names[model.provider] = getProviderDisplayName(model.provider);
  }

  if (userId) {
    for (const provider of await listUserModelProviders(userId)) {
      if (provider.enabled && provider.hasApiKey && provider.models.length > 0) {
        names[provider.provider] = provider.name;
      }
    }
  }

  return names;
};

export const findAvailableModel = async (
  modelId?: string,
  provider?: string,
  userId?: string,
): Promise<ConfiguredModel | undefined> => {
  if (!modelId) return undefined;

  if (userId) {
    const [userModels, userProviders] = await Promise.all([
      getUserConfiguredModels(userId),
      listUserModelProviders(userId),
    ]);
    const userModel = userModels.find(
      (model) => model.id === modelId && (!provider || model.provider === provider),
    );
    if (userModel) return userModel;

    const overriddenProviders = new Set(
      userProviders
        .filter((item) => item.enabled && item.hasApiKey && item.models.length > 0)
        .map((item) => item.provider),
    );
    const disabledProviders = new Set(
      userProviders.filter((item) => !item.enabled).map((item) => item.provider),
    );
    if (provider && disabledProviders.has(provider)) return undefined;
    if (provider && overriddenProviders.has(provider)) return undefined;

    const siteModel = findConfiguredModel(modelId, provider);
    if (siteModel && disabledProviders.has(siteModel.provider)) return undefined;
    if (siteModel && overriddenProviders.has(siteModel.provider)) return undefined;
    return siteModel;
  }

  return findConfiguredModel(modelId, provider);
};
