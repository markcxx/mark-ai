export type ModelRuntime = 'gemini' | 'openai-compatible';

export type ConfiguredModel = {
  id: string;
  provider: string;
  runtime: ModelRuntime;
  apiKey: string;
  baseUrl?: string;
};

export type PublicConfiguredModel = Pick<ConfiguredModel, 'id' | 'provider'>;

type ProviderEnvConfig = {
  defaultBaseUrl?: string;
  prefix: string;
  provider: string;
  runtime: ModelRuntime;
};

const BUILTIN_PROVIDERS: ProviderEnvConfig[] = [
  {
    prefix: 'GEMINI',
    provider: 'gemini',
    runtime: 'gemini',
  },
  {
    defaultBaseUrl: 'https://api.openai.com/v1',
    prefix: 'OPENAI',
    provider: 'openai',
    runtime: 'openai-compatible',
  },
  {
    defaultBaseUrl: 'https://api.deepseek.com',
    prefix: 'DEEPSEEK',
    provider: 'deepseek',
    runtime: 'openai-compatible',
  },
];

const parseModelIds = (value?: string) => {
  return (value || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);
};

const envPrefix = (provider: string) => provider.trim().replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();

const normalizeRuntime = (value?: string): ModelRuntime => {
  const runtime = value?.trim().toLowerCase();
  return runtime === 'gemini' ? 'gemini' : 'openai-compatible';
};

const getDefaultRuntime = (provider: string): ModelRuntime => {
  return provider.toLowerCase() === 'gemini' ? 'gemini' : 'openai-compatible';
};

const getDefaultBaseUrl = (provider: string) => {
  return BUILTIN_PROVIDERS.find(item => item.provider === provider)?.defaultBaseUrl;
};

const getEnvBaseUrl = (prefix: string, fallback?: string) => {
  return (
    process.env[`${prefix}_BASE_URL`]?.trim() ||
    process.env[`${prefix}_API_URL`]?.trim() ||
    fallback
  );
};

const getProviderModels = ({ provider, prefix, runtime, defaultBaseUrl }: ProviderEnvConfig) => {
  const apiKey = process.env[`${prefix}_API_KEY`]?.trim();
  const modelIds = parseModelIds(process.env[`${prefix}_MODELS`]);

  if (!apiKey || modelIds.length === 0) return [];

  const baseUrl = getEnvBaseUrl(prefix, defaultBaseUrl);

  return modelIds.map(id => ({
    apiKey,
    baseUrl,
    id,
    provider,
    runtime,
  }));
};

const getCustomProviderModels = () => {
  return parseModelIds(process.env.AI_PROVIDERS).flatMap(provider => {
    const normalizedProvider = provider.toLowerCase();
    const prefix = envPrefix(provider);

    if (BUILTIN_PROVIDERS.some(item => item.provider === normalizedProvider)) return [];

    return getProviderModels({
      defaultBaseUrl: getEnvBaseUrl(prefix),
      prefix,
      provider: normalizedProvider,
      runtime: normalizeRuntime(process.env[`${prefix}_RUNTIME`]),
    });
  });
};

const getAutoDiscoveredProviderModels = () => {
  const builtinPrefixes = new Set(BUILTIN_PROVIDERS.map(item => item.prefix));
  const explicitPrefixes = new Set(parseModelIds(process.env.AI_PROVIDERS).map(envPrefix));
  const discoveredPrefixes = new Set<string>();

  for (const key of Object.keys(process.env)) {
    const match = key.match(/^([A-Z0-9_]+)_API_KEY$/);
    if (!match) continue;

    const prefix = match[1];
    if (builtinPrefixes.has(prefix) || explicitPrefixes.has(prefix)) continue;
    if (!process.env[`${prefix}_MODELS`]?.trim()) continue;

    discoveredPrefixes.add(prefix);
  }

  return [...discoveredPrefixes].flatMap(prefix =>
    getProviderModels({
      defaultBaseUrl: getEnvBaseUrl(prefix),
      prefix,
      provider: prefix.toLowerCase(),
      runtime: normalizeRuntime(process.env[`${prefix}_RUNTIME`]),
    }),
  );
};

const getJsonConfiguredModels = () => {
  const raw = process.env.AI_MODEL_CONFIGS?.trim();
  if (!raw) return [];

  try {
    const configs = JSON.parse(raw);
    if (!Array.isArray(configs)) return [];

    return configs.flatMap((item): ConfiguredModel[] => {
      if (!item || typeof item !== 'object') return [];

      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) return [];

      const provider =
        typeof item.provider === 'string' && item.provider.trim()
          ? item.provider.trim().toLowerCase()
          : 'custom';
      const prefix = envPrefix(provider);
      const apiKey =
        (typeof item.apiKey === 'string' ? item.apiKey.trim() : '') ||
        (typeof item.apiKeyEnv === 'string' ? process.env[item.apiKeyEnv]?.trim() : '') ||
        process.env[`${prefix}_API_KEY`]?.trim() ||
        '';

      if (!apiKey) return [];

      const baseUrl =
        (typeof item.baseUrl === 'string' ? item.baseUrl.trim() : '') ||
        (typeof item.baseUrlEnv === 'string' ? process.env[item.baseUrlEnv]?.trim() : '') ||
        getEnvBaseUrl(prefix) ||
        getDefaultBaseUrl(provider);

      const rawRuntime =
        typeof item.runtime === 'string'
          ? item.runtime
          : typeof item.type === 'string'
            ? item.type
            : getDefaultRuntime(provider);

      return [
        {
          apiKey,
          baseUrl,
          id,
          provider,
          runtime: normalizeRuntime(rawRuntime),
        },
      ];
    });
  } catch (error) {
    console.error('Invalid AI_MODEL_CONFIGS:', error);
    return [];
  }
};

export const getConfiguredModels = (): ConfiguredModel[] => {
  const models = [
    ...BUILTIN_PROVIDERS.flatMap(getProviderModels),
    ...getCustomProviderModels(),
    ...getAutoDiscoveredProviderModels(),
    ...getJsonConfiguredModels(),
  ];

  const seen = new Set<string>();

  return models.filter(model => {
    const key = `${model.provider}:${model.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getPublicConfiguredModels = (): PublicConfiguredModel[] => {
  return getConfiguredModels().map(({ id, provider }) => ({ id, provider }));
};

export const findConfiguredModel = (modelId?: string, provider?: string) => {
  if (!modelId) return undefined;
  return getConfiguredModels().find(model => {
    if (provider && model.provider !== provider) return false;
    return model.id === modelId;
  });
};
