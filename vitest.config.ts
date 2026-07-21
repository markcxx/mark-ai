import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["{app,components,hooks,lib,stores}/**/*.test.{ts,tsx}"],
  },
});
