import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ tokens: vi.fn() }));
vi.mock("shiki/bundle/full", () => ({
  bundledLanguages: { javascript: {}, js: {} },
  codeToTokens: mocks.tokens,
}));
beforeEach(() => {
  vi.resetModules();
  mocks.tokens.mockReset();
});
it("deduplicates concurrent requests and keeps theme-specific results", async () => {
  mocks.tokens.mockImplementation(async (_code, options) => ({ tokens: [], bg: options.theme }));
  const { highlightCode } = await import("./highlight");
  const [a, b] = await Promise.all([
    highlightCode("let x", "js", "one-light"),
    highlightCode("let x", "js", "one-light"),
  ]);
  expect(a).toBe(b);
  await highlightCode("let x", "js", "one-light");
  expect(mocks.tokens).toHaveBeenCalledTimes(1);
  expect((await highlightCode("let x", "js", "one-dark-pro")).bg).toBe("one-dark-pro");
  expect(mocks.tokens).toHaveBeenCalledTimes(2);
});
it("retries failed work and bounds the cache", async () => {
  mocks.tokens.mockRejectedValueOnce(new Error("temporary")).mockResolvedValue({ tokens: [] });
  const { highlightCode } = await import("./highlight");
  await expect(highlightCode("a", "unknown", "one-light")).rejects.toThrow("temporary");
  await highlightCode("a", "unknown", "one-light");
  expect(mocks.tokens).toHaveBeenLastCalledWith("a", { lang: "text", theme: "one-light" });
  for (let i = 0; i < 33; i++) await highlightCode(String(i), "js", "one-light");
  await highlightCode("a", "unknown", "one-light");
  expect(mocks.tokens).toHaveBeenCalledTimes(36);
});
