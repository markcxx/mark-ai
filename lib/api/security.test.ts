import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), record: vi.fn(), cloud: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/server/user-platforms", () => ({ recordUserPlatform: mocks.record }));
vi.mock("@/lib/env", () => ({ isCloudMode: mocks.cloud }));
import { authorizeApiRequest } from "./security";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cloud.mockReturnValue(true);
});
it("records only authenticated non-banned cloud users using their session identity", async () => {
  const request = new NextRequest("https://example.invalid/api/models", {
    headers: { "x-markai-platform": "android", "x-user-id": "spoof" },
  });
  mocks.session.mockResolvedValue(null);
  expect((await authorizeApiRequest(request)).authorized).toBe(false);
  mocks.session.mockResolvedValue({ user: { id: "u1", banned: true } });
  expect((await authorizeApiRequest(request)).authorized).toBe(false);
  expect(mocks.record).not.toHaveBeenCalled();
  mocks.session.mockResolvedValue({ user: { id: "u1" } });
  expect((await authorizeApiRequest(request)).authorized).toBe(true);
  expect(mocks.record).toHaveBeenCalledWith("u1", request.headers);
  mocks.record.mockClear();
  mocks.cloud.mockReturnValue(false);
  await authorizeApiRequest(request);
  expect(mocks.record).not.toHaveBeenCalled();
});
