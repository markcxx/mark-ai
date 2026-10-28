import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  where: vi.fn(),
  decrypt: vi.fn((value: string) => `clear-${value}`),
}));
vi.mock("./db", () => ({ getDb: () => ({ select: mocks.select }) }));
vi.mock("./credential-crypto", () => ({ decryptCredential: mocks.decrypt }));
import { getUserModelConfiguration } from "./user-model-providers";
it("resolves models and overrides with one read and never decrypts disabled providers", async () => {
  mocks.select.mockReturnValue({ from: () => ({ where: mocks.where }) });
  mocks.where.mockResolvedValue([
    {
      id: "a",
      provider: "enabled",
      name: "Enabled",
      enabled: true,
      apiKeyEncrypted: "a",
      baseUrl: "https://example.com/v1",
      models: ["model"],
      runtime: "openai-compatible",
      isCustom: true,
    },
    {
      id: "b",
      provider: "disabled",
      name: "Disabled",
      enabled: false,
      apiKeyEncrypted: "b",
      baseUrl: "https://example.com/v1",
      models: ["model"],
      runtime: "openai-compatible",
      isCustom: true,
    },
  ]);
  const result = await getUserModelConfiguration("owner");
  expect(mocks.select).toHaveBeenCalledTimes(1);
  expect(result.models).toHaveLength(1);
  expect(result.models[0]).toMatchObject({ id: "model", provider: "enabled", apiKey: "clear-a" });
  expect(result.providers).toHaveLength(2);
  expect(result.providers[1].enabled).toBe(false);
  expect(mocks.decrypt).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result.providers)).not.toContain("clear-");
});
