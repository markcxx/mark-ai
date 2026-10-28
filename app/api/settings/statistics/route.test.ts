import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  overview: vi.fn(),
  monthly: vi.fn(),
}));
vi.mock("@/lib/api/security", () => ({
  authorizeApiRequest: mocks.auth,
  enforceRateLimit: mocks.limit,
}));
vi.mock("@/lib/settings/statistics-server", () => ({
  getStatisticsOverview: mocks.overview,
  getMonthlyUsage: mocks.monthly,
}));
import { GET } from "./route";
const request = (query = "") => new NextRequest(`http://localhost/api/settings/statistics${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ authorized: true, userId: "owner", key: "user:owner" });
  mocks.limit.mockReturnValue(null);
  mocks.overview.mockResolvedValue({});
  mocks.monthly.mockResolvedValue({});
});
it("uses authenticated ownership for web and app, with private uncached responses", async () => {
  const response = await GET(request("?userId=other"));
  expect(mocks.overview).toHaveBeenCalledWith("owner");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  await GET(
    request(
      "?view=monthly&month=2026-10&page=2&pageSize=20&sort=tokens&direction=asc&userId=other",
    ),
  );
  expect(mocks.monthly).toHaveBeenCalledWith("owner", "2026-10", 2, 20, "tokens", "asc");
});
it.each(["month=2026-13", "month=not-date", "page=-1", "page=Infinity", "pageSize=100000"])(
  "rejects invalid parameters %s",
  async (q) => {
    expect((await GET(request(`?view=monthly&${q}`))).status).toBe(400);
    expect(mocks.monthly).not.toHaveBeenCalled();
  },
);
it("never queries unauthenticated or rate limited requests", async () => {
  mocks.auth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({}, { status: 401 }),
  });
  expect((await GET(request())).status).toBe(401);
  mocks.auth.mockResolvedValue({ authorized: true, userId: "owner", key: "user:owner" });
  mocks.limit.mockReturnValue(NextResponse.json({}, { status: 429 }));
  expect((await GET(request())).status).toBe(429);
  expect(mocks.overview).not.toHaveBeenCalled();
});
