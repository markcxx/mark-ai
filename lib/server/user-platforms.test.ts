import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const db = vi.hoisted(() => ({ values: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ insert: () => ({ values: db.values }) }) }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T00:00:00Z"));
  db.upsert.mockReset().mockResolvedValue(undefined);
  db.values.mockReset().mockReturnValue({ onConflictDoUpdate: db.upsert });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("durable user platform tracking", () => {
  it("coalesces concurrent requests, throttles activity, and records version changes immediately", async () => {
    const { recordUserPlatform } = await import("./user-platforms");
    const headers = new Headers({
      "x-markai-platform": "android",
      "x-markai-app-version": "1.0.8",
    });
    await Promise.all(Array.from({ length: 10 }, () => recordUserPlatform("u1", headers)));
    expect(db.upsert).toHaveBeenCalledTimes(1);
    await recordUserPlatform("u1", headers);
    expect(db.upsert).toHaveBeenCalledTimes(1);
    headers.set("x-markai-app-version", "1.0.9");
    await recordUserPlatform("u1", headers);
    expect(db.upsert).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(301_000);
    await recordUserPlatform("u1", headers);
    expect(db.upsert).toHaveBeenCalledTimes(3);
    await recordUserPlatform("u1", new Headers({ "x-markai-platform": "web" }));
    await recordUserPlatform("u2", headers);
    expect(db.upsert).toHaveBeenCalledTimes(5);
  });
  it("preserves first-seen and has no login-session foreign key in writes", async () => {
    const { recordUserPlatform } = await import("./user-platforms");
    await recordUserPlatform("u1", new Headers({ "x-markai-platform": "web" }));
    expect(db.values.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      platform: "web",
      firstSeenAt: new Date(),
    });
    expect(db.upsert.mock.calls[0][0].set).not.toHaveProperty("firstSeenAt");
    const query = new PgDialect().sqlToQuery(db.upsert.mock.calls[0][0].setWhere);
    expect(query.sql).toContain('"user_platforms"."last_seen_at" <=');
    expect(query.sql).toContain("is distinct from");
  });
  it("does not fail authenticated work on a database error and retries later", async () => {
    const { recordUserPlatform } = await import("./user-platforms");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    db.upsert.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(recordUserPlatform("u1", new Headers())).resolves.toBeUndefined();
    await recordUserPlatform("u1", new Headers());
    expect(db.upsert).toHaveBeenCalledTimes(2);
  });
});
