import { describe, expect, it } from "vitest";

import { shouldUseDevelopmentProxy } from "./development-proxy";

describe("shouldUseDevelopmentProxy", () => {
  it("enables an environment proxy during local development", () => {
    expect(
      shouldUseDevelopmentProxy({
        HTTPS_PROXY: "http://127.0.0.1:7897",
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it("does not enable the proxy in production", () => {
    expect(
      shouldUseDevelopmentProxy({
        HTTPS_PROXY: "http://127.0.0.1:7897",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("does not enable the proxy when no proxy URL is configured", () => {
    expect(shouldUseDevelopmentProxy({ NODE_ENV: "development" })).toBe(false);
  });

  it("supports explicitly disabling the development proxy", () => {
    expect(
      shouldUseDevelopmentProxy({
        HTTPS_PROXY: "http://127.0.0.1:7897",
        MARKAI_DISABLE_ENV_PROXY: "true",
        NODE_ENV: "development",
      }),
    ).toBe(false);
  });
});
