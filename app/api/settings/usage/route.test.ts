import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), usage: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/api/security", () => ({
  authorizeApiRequest: mocks.auth,
  enforceRateLimit: mocks.limit,
}));
vi.mock("@/lib/settings/usage-server", () => ({ getSettingsUsage: mocks.usage }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ authorized: true, key: "user:u", userId: "u" });
  mocks.limit.mockReturnValue(null);
  mocks.usage.mockResolvedValue({ totalTokens: 12 });
});
it("uses only the authenticated identity and a bounded supported range", async () => {
  const response = await GET(
    new NextRequest("https://example.test/api/settings/usage?userId=other&days=9000"),
  );
  expect(mocks.usage).toHaveBeenCalledWith("u", 30);
  expect(await response.json()).toEqual({ totalTokens: 12 });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("rejects anonymous and rate-limited requests without reading usage", async () => {
  mocks.auth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({}, { status: 401 }),
  });
  expect((await GET(new NextRequest("https://example.test/api/settings/usage"))).status).toBe(401);
  expect(mocks.usage).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValue({ authorized: true, key: "user:u", userId: "u" });
  mocks.limit.mockReturnValue(NextResponse.json({}, { status: 429 }));
  expect((await GET(new NextRequest("https://example.test/api/settings/usage"))).status).toBe(429);
  expect(mocks.usage).not.toHaveBeenCalled();
});
it("accepts the requested supported range", async () => {
  await GET(new NextRequest("https://example.test/api/settings/usage?days=7"));
  expect(mocks.usage).toHaveBeenCalledWith("u", 7);
});
