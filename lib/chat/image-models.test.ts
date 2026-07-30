import { describe, expect, it } from "vitest";

import { IMAGE_GENERATION_MODEL_IDS, isImageGenerationModel } from "./image-models";

describe("image model registry", () => {
  it("keeps gpt-image-2 as the only image model", () => {
    expect(IMAGE_GENERATION_MODEL_IDS).toEqual(["gpt-image-2"]);
    expect(isImageGenerationModel("gpt-image-2")).toBe(true);
    expect(isImageGenerationModel("gpt-5.4")).toBe(false);
  });
});
