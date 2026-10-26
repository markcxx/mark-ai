export const IMAGE_GENERATION_MODEL_IDS = [
  "gpt-image-2",
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
  "wan2.7-image",
  "wan2.7-image-pro",
  "qwen-image-2.0",
  "qwen-image-2.0-pro",
  "qwen-image-3.0-pro",
] as const;

const imageGenerationModelIds = new Set<string>(IMAGE_GENERATION_MODEL_IDS);

export const isImageGenerationModel = (modelId?: string) =>
  Boolean(modelId && imageGenerationModelIds.has(modelId.trim().toLowerCase()));

export const isDashScopeImageModel = (modelId: string) => {
  const id = modelId.trim().toLowerCase();
  return imageGenerationModelIds.has(id) && (id.startsWith("wan") || id.startsWith("qwen-image-"));
};
