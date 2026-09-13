import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ discover: vi.fn(), limit: vi.fn(), saved: vi.fn() }));
vi.mock("@/lib/api/security", () => ({
  authorizeApiRequest: async () => ({ authorized: true, key: "test", userId: "user-a" }),
  enforceRateLimit: mocks.limit,
}));
vi.mock("@/lib/models", () => ({
  getConfiguredModels: () => [
    {
      provider: "site",
      apiKey: "server-secret",
      baseUrl: "https://site.example/v1",
      runtime: "openai-compatible",
    },
  ],
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: mocks.saved }) }) }) }),
}));
vi.mock("@/lib/credential-crypto", () => ({ decryptCredential: () => "saved-secret" }));
vi.mock("@/lib/server/provider-model-discovery", () => ({
  discoverProviderModels: mocks.discover,
}));
import { POST } from "./route";
const request = (body: unknown, origin = "https://markai.example") =>
  new NextRequest("https://markai.example/api/model-providers/discover", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockReturnValue(null);
  mocks.saved.mockResolvedValue([]);
  mocks.discover.mockResolvedValue(["real-model"]);
});
it("uses server credentials only with the server configured endpoint", async () => {
  const response = await POST(
    request({ provider: "site", site: true, baseUrl: "https://attacker.example" }),
  );
  expect(await response.json()).toEqual({ models: ["real-model"] });
  expect(mocks.discover).toHaveBeenCalledWith(
    expect.objectContaining({ baseUrl: "https://site.example/v1", apiKey: "server-secret" }),
  );
});
it("does not forward a saved credential to an edited endpoint", async () => {
  mocks.saved.mockResolvedValue([
    { apiKeyEncrypted: "cipher", baseUrl: "https://original.example/v1" },
  ]);
  expect(
    (await POST(request({ provider: "custom", baseUrl: "https://other.example/v1" }))).status,
  ).toBe(400);
  expect(mocks.discover).not.toHaveBeenCalled();
});
it("rejects cross-origin discovery", async () => {
  expect(
    (await POST(request({ provider: "site", site: true }, "https://other.example"))).status,
  ).toBe(403);
  expect(mocks.discover).not.toHaveBeenCalled();
});
it("does not return internal exception details", async () => {
  mocks.discover.mockRejectedValue(new Error("request server-secret failed"));
  const response = await POST(request({ provider: "site", site: true }));
  expect(await response.text()).not.toContain("server-secret");
});
