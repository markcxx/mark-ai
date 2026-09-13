import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  models: vi.fn(),
  presentations: vi.fn(),
  providers: vi.fn(),
}));
vi.mock("@/lib/api/security", () => ({
  authorizeApiRequest: mocks.authorize,
  enforceRateLimit: vi.fn(),
}));
vi.mock("@/lib/available-models", () => ({
  getAvailablePublicModels: mocks.models,
  getAvailableProviderNames: async () => ({ a: "A" }),
}));
vi.mock("@/lib/model-presentation-server", () => ({ readModelPresentations: mocks.presentations }));
vi.mock("@/lib/user-model-providers", () => ({ listUserModelProviders: mocks.providers }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) }),
}));
import { GET } from "./route";
import { DEFAULT_MODEL_PRESENTATION } from "@/lib/model-presentation";

const request = () => new NextRequest("https://markai.test/api/models");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ authorized: true, key: "local" });
  mocks.models.mockResolvedValue([{ provider: "a", id: "model" }]);
  mocks.presentations.mockResolvedValue([
    {
      ...DEFAULT_MODEL_PRESENTATION,
      provider: "a",
      modelId: "model",
      displayName: "展示名称",
      isNew: true,
      newRevision: "launch",
    },
  ]);
  mocks.providers.mockResolvedValue([]);
});
it("adds optional metadata without changing model identity or response caching", async () => {
  const response = await GET(request());
  const data = await response.json();
  expect(data.models).toEqual([
    expect.objectContaining({
      id: "model",
      provider: "a",
      presentation: expect.objectContaining({ displayName: "展示名称", isNew: true }),
    }),
  ]);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("does not apply site promotions to a user's replacement provider", async () => {
  mocks.authorize.mockResolvedValue({ authorized: true, key: "user", userId: "user" });
  mocks.providers.mockResolvedValue([
    { provider: "a", enabled: true, hasApiKey: true, models: ["model"] },
  ]);
  expect((await (await GET(request())).json()).models).toEqual([{ id: "model", provider: "a" }]);
});
it("keeps models usable if optional metadata is unavailable", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.presentations.mockRejectedValue(new Error("metadata unavailable"));
  try {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).models).toEqual([{ id: "model", provider: "a" }]);
  } finally {
    log.mockRestore();
  }
});
it("preserves protected model API behavior for guests", async () => {
  mocks.authorize.mockResolvedValue({
    authorized: false,
    response: new Response(null, { status: 401 }),
  });
  expect((await GET(request())).status).toBe(401);
  expect(mocks.models).not.toHaveBeenCalled();
  expect(mocks.presentations).not.toHaveBeenCalled();
});
