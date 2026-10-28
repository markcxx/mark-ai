import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ cloud: vi.fn(), database: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/env", () => ({ isCloudMode: mocks.cloud }));
vi.mock("@/lib/chat/sqlite-storage", () => ({ ensureDatabase: mocks.database }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ execute: mocks.execute }) }));
import { getMonthlyUsage, getStatisticsOverview } from "./statistics-server";
type TestDb = {
  exec: (sql: string) => void;
  close: () => void;
  prepare: (sql: string) => { run: (...args: unknown[]) => void };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (p: string) => TestDb;
};
let db: TestDb;
const now = new Date("2026-10-28T12:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cloud.mockReturnValue(false);
  db = new DatabaseSync(":memory:");
  mocks.database.mockReturnValue(db);
  db.exec(`CREATE TABLE chat_sessions(id TEXT, title TEXT, created_at INTEGER);
 CREATE TABLE chat_messages(id TEXT, session_id TEXT, role TEXT, provider TEXT, model TEXT, created_at INTEGER, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER, generation_duration INTEGER, token_usage_source TEXT, interrupted INTEGER);`);
  db.prepare("INSERT INTO chat_sessions VALUES(?,?,?)").run(
    "s",
    "真实话题",
    Date.parse("2026-09-15T12:00:00Z"),
  );
});
afterEach(() => db.close());
function message(
  id: string,
  date: string,
  provider = "p",
  total: number | null = 20,
  role = "model",
) {
  db.prepare("INSERT INTO chat_messages VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
    id,
    "s",
    role,
    provider,
    "same-model",
    Date.parse(date),
    null,
    null,
    total,
    2500,
    total === null ? null : "provider",
    0,
  );
}
it("aggregates lifetime, comparison, annual activity and provider/model ranks without counting user tokens", async () => {
  message("a", "2026-09-30T23:59:59Z");
  message("b", "2026-10-01T00:00:00Z", "q", 30);
  message("c", "2026-10-28T11:00:00Z", "p", 1000, "user");
  const result = await getStatisticsOverview(undefined, now);
  expect(result.metrics.topics).toEqual({ value: 1, previous: 1 });
  expect(result.metrics.messages).toEqual({ value: 3, previous: 1 });
  expect(result.metrics.tokens).toEqual({ value: 50, previous: 20 });
  expect(result.ranks.models).toHaveLength(2);
  expect(result.ranks.topics[0]).toMatchObject({ id: "s", name: "真实话题", count: 3 });
  expect(result.ranks.assistants[0].count).toBe(2);
  expect(result.longestTaskMs).toBe(2500);
  expect(result.activity.reduce((n, d) => n + d.tokens, 0)).toBe(50);
});
it("bounds monthly data, sorts the full set before pagination and retains unknown usage", async () => {
  message("before", "2026-09-30T23:59:59Z");
  message("after", "2026-11-01T00:00:00Z");
  for (let i = 0; i < 7; i++)
    message(
      String(i),
      `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      "p",
      i === 0 ? null : i * 10,
    );
  const result = await getMonthlyUsage(undefined, "2026-10", 1, 5, "tokens", "desc");
  expect(result.total).toBe(7);
  expect(result.records.map((r) => r.id)).toEqual(["6", "5", "4", "3", "2"]);
  const last = await getMonthlyUsage(undefined, "2026-10", 999, 5, "tokens", "desc");
  expect(last.page).toBe(2);
  expect(last.records.at(-1)?.totalTokens).toBeNull();
  expect(last.billingAvailable).toBe(false);
  expect(last.daily.reduce((n, r) => n + r.calls, 0)).toBe(7);
});
it("enforces ownership in every cloud statement and binds user input", async () => {
  mocks.cloud.mockReturnValue(true);
  mocks.execute.mockResolvedValue({ rows: [] });
  await expect(getStatisticsOverview(undefined, now)).rejects.toThrow("请先登录");
  expect(mocks.execute).not.toHaveBeenCalled();
  const owner = "user' OR 1=1 --";
  await getStatisticsOverview(owner, now);
  await getMonthlyUsage(owner, "2026-10", 1, 5);
  const dialect = new PgDialect();
  for (const [statement] of mocks.execute.mock.calls) {
    const query = dialect.sqlToQuery(statement);
    expect(query.sql).not.toContain(owner);
    expect(query.params).toContain(owner);
    expect(query.sql).toMatch(/WHERE (s\.user_id = \$\d+|id = \$\d+)/);
  }
});
