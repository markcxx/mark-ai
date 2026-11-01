import { afterEach, expect, it, vi } from "vitest";
import { getAppUrl, isAllowedOrigin } from "./app-url";

afterEach(() => vi.unstubAllEnvs());

const post = (origin?: string) =>
  new Request("https://ai.example.com/api/x", {
    method: "POST",
    headers: origin ? { origin } : {},
  });

it("reads APP_URL and falls back to the legacy public variable", () => {
  vi.stubEnv("APP_URL", "https://ai.example.com/");
  expect(getAppUrl()).toBe("https://ai.example.com");
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://legacy.example.com");
  expect(getAppUrl()).toBe("https://legacy.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url");
  expect(getAppUrl()).toBeUndefined();
});

it("allows same-origin and configured origins only", () => {
  vi.stubEnv("APP_URL", "https://app.example.com");
  expect(isAllowedOrigin(post())).toBe(true);
  expect(isAllowedOrigin(post("https://ai.example.com"))).toBe(true);
  expect(isAllowedOrigin(post("https://app.example.com"))).toBe(true);
  expect(isAllowedOrigin(post("https://evil.example.com"))).toBe(false);
});
