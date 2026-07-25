type ModelIdentity = {
  id: string;
  provider: string;
};

const MODEL_FAMILY_PATTERNS: Array<[RegExp, string]> = [
  [/deepseek/i, "deepseek"],
  [/doubao/i, "doubao"],
  [/qwen/i, "qwen"],
  [/gemini/i, "gemini"],
  [/claude/i, "claude"],
  [/(?:^|[-_.])gpt(?:[-_.]|$)/i, "gpt"],
  [/^o\d/i, "openai-o"],
  [/kimi/i, "kimi"],
  [/moonshot/i, "moonshot"],
  [/minimax/i, "minimax"],
  [/(?:^|[-_.])glm(?:[-_.]|$)/i, "glm"],
  [/grok/i, "grok"],
  [/mimo/i, "mimo"],
  [/llama/i, "llama"],
  [/mistral/i, "mistral"],
  [/command/i, "command"],
  [/(?:^|[-_.])yi(?:[-_.]|$)/i, "yi"],
  [/(?:^|[-_.])phi(?:[-_.]|$)/i, "phi"],
  [/ernie/i, "ernie"],
  [/hunyuan/i, "hunyuan"],
  [/baichuan/i, "baichuan"],
];

const MODEL_TIER_SCORES: Record<string, number> = {
  pro: 100,
  max: 95,
  ultra: 90,
  opus: 85,
  plus: 80,
  sonnet: 75,
  thinking: 70,
  reasoner: 70,
  coder: 65,
  code: 65,
  turbo: 60,
  flash: 50,
  mini: 40,
  lite: 30,
  nano: 20,
};

const naturalCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const normalizeModelId = (modelId: string) => {
  const pathParts = modelId.trim().toLowerCase().split("/").filter(Boolean);
  return pathParts.at(-1) || modelId.trim().toLowerCase();
};

export const isMarkAIProvider = (provider: string) =>
  provider.trim().toLowerCase().startsWith("mark");

export const compareModelProviders = (left: string, right: string) => {
  const leftIsMarkAI = isMarkAIProvider(left);
  const rightIsMarkAI = isMarkAIProvider(right);

  if (leftIsMarkAI === rightIsMarkAI) return 0;
  return leftIsMarkAI ? -1 : 1;
};

export const getModelFamilyKey = (modelId: string) => {
  const normalized = normalizeModelId(modelId);
  const knownFamily = MODEL_FAMILY_PATTERNS.find(([pattern]) => pattern.test(normalized));
  if (knownFamily) return knownFamily[1];

  return normalized.match(/[a-z]+/)?.[0] || normalized;
};

const getVersionParts = (modelId: string, family: string) => {
  const normalized = normalizeModelId(modelId);
  const familyIndex = normalized.indexOf(family);
  const versionSource =
    familyIndex >= 0 ? normalized.slice(familyIndex + family.length) : normalized;
  const matches = versionSource.matchAll(/[vkmr]?(\d+(?:[.-]\d+)?)/g);

  for (const match of matches) {
    let rawVersion = match[1];
    const nextCharacter = versionSource[match.index + match[0].length];

    // In IDs such as qwen3-235b or moonshot-v1-128k, the trailing
    // number describes model size/context rather than the model version.
    if ((nextCharacter === "b" || nextCharacter === "k") && /[.-]/.test(rawVersion)) {
      rawVersion = rawVersion.replace(/[.-]\d+$/, "");
    } else if (nextCharacter === "b" || nextCharacter === "k") {
      continue;
    }

    const parts = rawVersion.split(/[.-]/).map(Number).filter(Number.isFinite);
    if (parts.length > 0) return parts;
  }

  return [];
};

const getParameterBillions = (modelId: string) => {
  const matches = [...normalizeModelId(modelId).matchAll(/(\d+(?:\.\d+)?)b(?:\b|[-_.])/g)];
  return matches.reduce((largest, match) => Math.max(largest, Number(match[1])), 0);
};

const getReleaseNumber = (modelId: string) => {
  const normalized = normalizeModelId(modelId);
  const fullDate = normalized.match(/(?:^|[-_.])(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?:$|[-_.])/);
  if (fullDate) return Number(`${fullDate[1]}${fullDate[2]}${fullDate[3]}`);

  const compactDate = normalized.match(/(?:^|[-_.])((?:20)?\d{2}(?:0[1-9]|1[0-2]))(?:$|[-_.])/);
  return compactDate ? Number(compactDate[1]) : 0;
};

const getTierScore = (modelId: string) => {
  const tokens = normalizeModelId(modelId).split(/[^a-z0-9]+/);
  return tokens.reduce((score, token) => Math.max(score, MODEL_TIER_SCORES[token] || 0), 0);
};

const compareNumberPartsDescending = (left: number[], right: number[]) => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (right[index] || 0) - (left[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

const compareModelsWithinFamily = <T extends ModelIdentity>(left: T, right: T) => {
  const family = getModelFamilyKey(left.id);
  const versionDifference = compareNumberPartsDescending(
    getVersionParts(left.id, family),
    getVersionParts(right.id, family),
  );
  if (versionDifference !== 0) return versionDifference;

  const parameterDifference = getParameterBillions(right.id) - getParameterBillions(left.id);
  if (parameterDifference !== 0) return parameterDifference;

  const releaseDifference = getReleaseNumber(right.id) - getReleaseNumber(left.id);
  if (releaseDifference !== 0) return releaseDifference;

  const tierDifference = getTierScore(right.id) - getTierScore(left.id);
  if (tierDifference !== 0) return tierDifference;

  return naturalCollator.compare(right.id, left.id);
};

export const sortModelsByFamily = <T extends ModelIdentity>(models: T[]) => {
  const families = new Map<string, T[]>();

  for (const model of models) {
    const family = getModelFamilyKey(model.id);
    const familyModels = families.get(family);
    if (familyModels) {
      familyModels.push(model);
    } else {
      families.set(family, [model]);
    }
  }

  return [...families.values()].flatMap((familyModels) =>
    [...familyModels].sort(compareModelsWithinFamily),
  );
};
