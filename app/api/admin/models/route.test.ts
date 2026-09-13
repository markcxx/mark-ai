import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  read: vi.fn(),
  batch: vi.fn(),
  values: vi.fn(),
}));
vi.mock("@/lib/admin/api", () => ({ authorizeAdminApi: mocks.authorize }));
vi.mock("@/lib/models", () => ({
  getPublicConfiguredModels: () => [
    { id: "same", provider: "a" },
    { id: "same", provider: "b" },
  ],
  getProviderDisplayName: (provider: string) => provider,
}));
vi.mock("@/lib/model-presentation-server", () => ({ readModelPresentations: mocks.read }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ batch: mocks.batch, insert: () => ({ values: mocks.values }) }),
}));
import { DEFAULT_MODEL_PRESENTATION } from "@/lib/model-presentation";
import { GET, PUT } from "./route";
const request = (patch = {}, origin = "https://markai.test") =>
  new Request("https://markai.test/api/admin/models", {
    method: "PUT",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      id: "same",
      provider: "a",
      presentation: { ...DEFAULT_MODEL_PRESENTATION, isNew: true },
      ...patch,
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ admin: { id: "admin" } });
  mocks.read.mockResolvedValue([]);
  mocks.values.mockReturnValue({ onConflictDoUpdate: vi.fn() });
});
it("checks administrator authorization before reading or writing metadata", async () => {
  mocks.authorize.mockResolvedValue({ response: new Response(null, { status: 403 }) });
  expect((await GET(request())).status).toBe(403);
  expect((await PUT(request())).status).toBe(403);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("rejects forged origins, absent site models and expired launches", async () => {
  expect((await PUT(request({}, "https://other.test"))).status).toBe(403);
  expect((await PUT(request({ provider: "private" }))).status).toBe(404);
  expect(
    (
      await PUT(
        request({
          presentation: {
            ...DEFAULT_MODEL_PRESENTATION,
            isNew: true,
            newUntil: "2000-01-01T00:00:00Z",
          },
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("lists all configured models while ignoring stale metadata", async () => {
  mocks.read.mockResolvedValue([
    { ...DEFAULT_MODEL_PRESENTATION, modelId: "removed", provider: "a" },
  ]);
  const result = await (await GET(request())).json();
  expect(result.models.map((m: { provider: string }) => m.provider)).toEqual(["a", "b"]);
  expect(result.models.every((m: object) => !("apiKey" in m))).toBe(true);
});
it("keeps the launch revision through edits and rotates it on relaunch", async () => {
  const first = await (await PUT(request())).json();
  expect(first.presentation.newRevision).toBeTruthy();
  mocks.read.mockResolvedValue([{ ...first.presentation, provider: "a", modelId: "same" }]);
  const edit = await (
    await PUT(request({ presentation: { ...first.presentation, displayName: "新名称" } }))
  ).json();
  expect(edit.presentation.newRevision).toBe(first.presentation.newRevision);
  mocks.read.mockResolvedValue([
    { ...first.presentation, isNew: false, provider: "a", modelId: "same" },
  ]);
  const relaunched = await (await PUT(request())).json();
  expect(relaunched.presentation.newRevision).not.toBe(first.presentation.newRevision);
  expect(mocks.values).toHaveBeenCalledWith(
    expect.objectContaining({ action: "model.presentation.update" }),
  );
});
