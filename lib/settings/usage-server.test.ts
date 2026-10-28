import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cloud: vi.fn(), database: vi.fn() }));
vi.mock("@/lib/env", () => ({ isCloudMode: mocks.cloud }));
vi.mock("@/lib/chat/sqlite-storage", () => ({ ensureDatabase: mocks.database }));
import { getSettingsUsage } from "./usage-server";
type TestDatabase = {
  exec: (sql: string) => void;
  close: () => void;
  prepare: (sql: string) => { run: (...values: unknown[]) => unknown };
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => TestDatabase;
};
let db: TestDatabase;
beforeEach(() => {
  mocks.cloud.mockReturnValue(false);
  db = new DatabaseSync(":memory:");
  mocks.database.mockReturnValue(db);
  db.exec(`CREATE TABLE chat_sessions (id TEXT, created_at INTEGER);
    CREATE TABLE chat_messages (role TEXT, provider TEXT, model TEXT, created_at INTEGER, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER);`);
});
afterEach(() => db.close());
it("aggregates actual current records without charging user messages or treating unknown usage as measured", async () => {
  const now = Date.now();
  db.prepare("INSERT INTO chat_sessions VALUES (?, ?)").run("s", now);
  const insert = db.prepare("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?, ?)");
  insert.run("user", null, null, now, 200, 0, 200);
  insert.run("model", "p", "m", now, 10, 5, null);
  insert.run("model", "p", "m", now, null, null, null);
  insert.run("model", "q", "m", now, null, null, 20);
  insert.run("model", "old", "m", now - 100 * 86400000, 100, 50, 150);
  const result = await getSettingsUsage(undefined, 7);
  expect(result).toMatchObject({
    sessions: 1,
    messages: 4,
    assistantMessages: 3,
    totalTokens: 35,
    measuredMessages: 2,
  });
  expect(result.models).toHaveLength(2);
  expect(result.models.find((row) => row.provider === "q")).toMatchObject({
    inputTokens: null,
    outputTokens: null,
    totalTokens: 20,
  });
  expect(result.daily.reduce((sum, row) => sum + row.messages, 0)).toBe(4);
});
it("returns an empty aggregate without invented activity", async () => {
  const result = await getSettingsUsage(undefined, 30);
  expect(result).toMatchObject({
    sessions: 0,
    messages: 0,
    assistantMessages: 0,
    totalTokens: 0,
    measuredMessages: 0,
    models: [],
  });
  expect(result.daily).toHaveLength(30);
});
it("requires an owner before querying cloud data", async () => {
  mocks.cloud.mockReturnValue(true);
  await expect(getSettingsUsage(undefined, 7)).rejects.toThrow("请先登录");
});
