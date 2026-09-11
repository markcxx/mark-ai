import { describe, expect, it } from "vitest";

import { isImageGenerationModel } from "./image-models";

describe("image model registry", () => {
  it.each(["gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.5-flare"])(
    "routes %s through image generation",
    (modelId) => {
      expect(isImageGenerationModel(modelId)).toBe(true);
      expect(isImageGenerationModel(` ${modelId.toUpperCase()} `)).toBe(true);
    },
  );

  it.each([undefined, "", " ", "gpt-5.4", "gpt-image-2.5-unknown"])(
    "does not classify %s as an image model",
    (modelId) => {
      expect(isImageGenerationModel(modelId)).toBe(false);
    },
  );
});
