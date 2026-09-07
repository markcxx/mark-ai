import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  session: vi.fn(),
  messages: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@/lib/auth-helpers", () => ({ getCurrentStorageOwnerId: mocks.owner }));
vi.mock("@/lib/chat/storage", () => ({
  getChatSession: mocks.session,
  getChatMessages: mocks.messages,
}));
vi.mock("@/lib/chat/share-storage", () => ({
  getSessionShare: mocks.get,
  saveConversationShare: mocks.save,
  revokeSessionShare: mocks.revoke,
}));
import { GET, POST, DELETE } from "./route";
const context = { params: Promise.resolve({ sessionId: "s" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue("u");
  mocks.session.mockResolvedValue({ id: "s", title: "test", revision: 1 });
  mocks.messages.mockResolvedValue([{ id: "m", role: "user", content: "test" }]);
});
it("returns JSON for missing tables on every share operation without logging conversation data", async () => {
  const error = Object.assign(new Error("private snapshot"), { cause: { code: "42P01" } });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    mocks.get.mockRejectedValue(error);
    mocks.save.mockRejectedValue(error);
    mocks.revoke.mockRejectedValue(error);
    for (const handler of [GET, POST, DELETE]) {
      const result = await handler(
        new Request("http://localhost/api/share", {
          method: "POST",
          body: JSON.stringify({ duration: 3600 }),
        }),
        context,
      );
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({
        error: "分享服务尚未就绪，请联系管理员完成数据库更新",
      });
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain("private snapshot");
  } finally {
    log.mockRestore();
  }
});
it("keeps authentication and input validation intact", async () => {
  mocks.owner.mockResolvedValue(null);
  expect((await GET(new Request("http://localhost"), context)).status).toBe(401);
  expect(mocks.get).not.toHaveBeenCalled();
  mocks.owner.mockResolvedValue("u");
  expect(
    (await POST(new Request("http://localhost", { method: "POST", body: "{}" }), context)).status,
  ).toBe(400);
  expect(mocks.save).not.toHaveBeenCalled();
});
