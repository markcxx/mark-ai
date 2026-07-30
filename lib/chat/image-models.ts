export const IMAGE_GENERATION_MODEL_IDS = ["gpt-image-2"] as const;

const imageGenerationModelIds = new Set<string>(IMAGE_GENERATION_MODEL_IDS);

export const isImageGenerationModel = (modelId?: string) =>
  Boolean(modelId && imageGenerationModelIds.has(modelId.trim().toLowerCase()));
