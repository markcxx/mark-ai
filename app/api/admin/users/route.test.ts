import { beforeEach, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonQueryFunction } from "@neondatabase/serverless";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/admin/api", async (original) => ({
  ...(await original<typeof import("@/lib/admin/api")>()),
  authorizeAdminApi: mocks.authorize,
}));
vi.mock("@/lib/db", () => ({
  getDb: () => drizzle(mocks.query as unknown as NeonQueryFunction<false, false>),
}));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ admin: { id: "admin" } });
  mocks.query.mockImplementation(async (query: string) => {
    if (query.startsWith('select count(*) from "users"')) return { rows: [[1]] };
    if (query.includes('from "users"')) {
      return {
        rows: [
          [
            28,
            null,
            false,
            "2026-09-01T00:00:00Z",
            "test@example.invalid",
            true,
            "Test",
            "u1",
            "user",
            null,
          ],
        ],
      };
    }
    if (query.includes('from "user_platforms"')) {
      return { rows: [["u1", "android", "1.0.8", "2026-09-10T00:00:00Z", "2026-09-11T00:00:00Z"]] };
    }
    return { rows: [] }; // No surviving login sessions.
  });
});

it("denies non-admin access without querying usage", async () => {
  mocks.authorize.mockResolvedValue({ response: new Response(null, { status: 403 }) });
  expect((await GET(new Request("https://example.invalid/api/admin/users"))).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});

it("filters both list and total by platform without duplicating multi-platform users", async () => {
  const response = await GET(
    new Request("https://example.invalid/api/admin/users?platform=android&page=2&limit=20"),
  );
  const data = await response.json();
  expect(data.page).toBe(2);
  expect(data.total).toBe(1);
  const userQueries = mocks.query.mock.calls.filter(([query]) => query.includes('from "users"'));
  expect(userQueries).toHaveLength(2);
  for (const [query, params] of userQueries) {
    expect(query).toContain("exists (select");
    expect(query).toContain('"user_platforms"."user_id" = "users"."id"');
    expect(params).toContain("android");
  }
  expect(data.users[0].platforms).toEqual([
    {
      platform: "android",
      appVersion: "1.0.8",
      firstSeenAt: "2026-09-10T00:00:00.000Z",
      lastSeenAt: "2026-09-11T00:00:00.000Z",
    },
  ]);
  expect(data.users[0].lastActiveAt).toBe("2026-09-11T00:00:00.000Z");
});

it("rejects invalid platform filters before querying the database", async () => {
  expect(
    (await GET(new Request("https://example.invalid/api/admin/users?platform=ios"))).status,
  ).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
