import { afterEach, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
vi.mock("@/lib/announcement", () => ({ readAnnouncement: read }));
import { GET } from "./route";
afterEach(() => { vi.unstubAllEnvs(); read.mockReset(); });
it("returns only the requested notice and hides disabled content", async () => {
  vi.stubEnv("DATABASE_URL", "test-only");
  read.mockResolvedValue({ enabled: true, content: "申请须知" });
  expect((await (await GET(new Request("https://markai.test/api/public/announcement?scope=registration"))).json()).announcement.content).toBe("申请须知");
  expect(read).toHaveBeenCalledWith("registration");
  read.mockResolvedValue({ enabled: false, content: "保留" });
  expect((await (await GET(new Request("https://markai.test/api/public/announcement"))).json()).announcement).toBeNull();
  expect(read).toHaveBeenLastCalledWith("current");
});
it("rejects unknown scopes without database access", async () => {
  expect((await GET(new Request("https://markai.test/api/public/announcement?scope=other"))).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
});
it("serves configured auth model examples independently", async () => {
  vi.stubEnv("DATABASE_URL", "test-only");
  read.mockResolvedValue({ enabled: true, content: "Example Model" });
  const response = await GET(new Request("https://markai.test/api/public/announcement?scope=auth-models"));
  expect(response.status).toBe(200);
  expect(read).toHaveBeenCalledWith("auth-models");
  expect((await response.json()).announcement.content).toBe("Example Model");
});
