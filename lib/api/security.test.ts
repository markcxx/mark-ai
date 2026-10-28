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

it("defers optional platform writes without skipping fresh authentication or ban checks", async () => {
  mocks.session.mockResolvedValue({ user: { id: "u1" } });
  mocks.record.mockImplementation(() => new Promise(() => {}));
  const schedule = vi.fn();
  const req = new NextRequest("https://example.invalid/api/chat");
  expect((await authorizeApiRequest(req, { deferPlatformRecord: schedule })).authorized).toBe(true);
  expect(mocks.record).not.toHaveBeenCalled();
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(mocks.session.mock.calls.at(-1)?.[0].query).toEqual({ disableCookieCache: true });
  schedule.mock.calls[0][0]();
  expect(mocks.record).toHaveBeenCalledWith("u1", req.headers);
});
