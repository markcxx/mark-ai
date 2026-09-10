import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  read: vi.fn(),
  batch: vi.fn(),
  values: vi.fn(),
}));
vi.mock("@/lib/admin/api", () => ({ authorizeAdminApi: mocks.authorize }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ batch: mocks.batch, insert: () => ({ values: mocks.values }) }),
}));
vi.mock("@/lib/announcement", async (original) => ({
  ...(await original<object>()),
  readAnnouncement: mocks.read,
}));
import { GET, PUT } from "./route";
import { parseAnnouncement } from "@/lib/announcement";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ admin: { id: "admin" } });
  mocks.values.mockReturnValue({ onConflictDoUpdate: vi.fn() });
});
const request = (content: unknown, origin = "https://markai.test") =>
  new Request("https://markai.test/api/admin/announcement", {
    method: "PUT",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ content }),
  });
it("denies non-admin reads and writes before accessing site data", async () => {
  mocks.authorize.mockResolvedValue({ response: new Response(null, { status: 403 }) });
  expect((await GET(request("x"))).status).toBe(403);
  expect((await PUT(request("x"))).status).toBe(403);
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("rejects cross-origin writes and invalid or oversized content", async () => {
  expect((await PUT(request("x", "https://other.test"))).status).toBe(403);
  for (const value of [null, 5, "x".repeat(1001)])
    expect((await PUT(request(value))).status).toBe(400);
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("publishes plain text and creates a new revision when republished or withdrawn", async () => {
  const first = await (await PUT(request("  新版本上线\n欢迎体验  "))).json();
  const next = await (await PUT(request("新版本上线\n欢迎体验"))).json();
  const withdrawn = await (await PUT(request(" \n "))).json();
  expect(first.announcement.content).toBe("新版本上线\n欢迎体验");
  expect(next.announcement.revision).not.toBe(first.announcement.revision);
  expect(withdrawn.announcement.content).toBe("");
  expect(mocks.batch).toHaveBeenCalledTimes(3);
  expect(mocks.values).toHaveBeenCalledWith(
    expect.objectContaining({ action: "announcement.withdraw" }),
  );
});
it("keeps markup as literal text without treating it as commands or HTML", () => {
  expect(parseAnnouncement({ content: "<script>alert(1)</script>" })).toBe(
    "<script>alert(1)</script>",
  );
  expect(parseAnnouncement({ content: "正常公告" })).toBe("正常公告");
});
it("saves display and action settings and can withdraw without clearing text", async () => {
  const response = await PUT(new Request("https://markai.test/api/admin/announcement", {
    method: "PUT", headers: {"content-type":"application/json"},
    body: JSON.stringify({content:"保留的公告",enabled:false,closable:false,actionEnabled:true,actionLabel:"下载 App",actionUrl:"/download"}),
  }));
  expect(response.status).toBe(200);
  expect((await response.json()).announcement).toMatchObject({content:"保留的公告",enabled:false,closable:false,actionEnabled:true,actionUrl:"/download"});
  expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({action:"announcement.withdraw"}));
});
