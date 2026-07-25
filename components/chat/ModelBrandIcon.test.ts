import { describe, expect, it } from "vitest";

import { getModelAssetKey } from "./ModelBrandIcon";

describe("model brand icon", () => {
  it.each(["qwen3.7-plus", "Qwen/Qwen3-235B-A22B", "qwq-32b"])(
    "uses the Qwen icon for %s",
    (modelId) => {
      expect(getModelAssetKey(modelId)).toBe("qwen");
    },
  );
});
