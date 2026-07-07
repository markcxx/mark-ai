export type ModelProvider = 'openai' | 'gemini' | 'deepseek';

export type ConfiguredModel = {
  id: string;
  provider: ModelProvider;
};

const MODEL_ENV_BY_PROVIDER: Record<ModelProvider, string> = {
  openai: 'OPENAI_MODELS',
  gemini: 'GEMINI_MODELS',
  deepseek: 'DEEPSEEK_MODELS',
};

const parseModelIds = (value?: string) => {
  return (value || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);
};

export const getConfiguredModels = (): ConfiguredModel[] => {
  return (Object.entries(MODEL_ENV_BY_PROVIDER) as [ModelProvider, string][])
    .flatMap(([provider, envName]) =>
      parseModelIds(process.env[envName]).map(id => ({
        id,
        provider,
      }))
    );
};

export const findConfiguredModel = (modelId?: string) => {
  if (!modelId) return undefined;
  return getConfiguredModels().find(model => model.id === modelId);
};
