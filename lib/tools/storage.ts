import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { sessionEnabledTools, userInstalledTools } from "@/lib/db/schema";
import { isCloudMode } from "@/lib/env";

type PreparedStatementLike = {
  all: (...values: unknown[]) => unknown[];
  run: (...values: unknown[]) => unknown;
};

type DatabaseLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => PreparedStatementLike;
};

const require = createRequire(import.meta.url);
let localDatabase: DatabaseLike | undefined;

const getDatabasePath = () =>
  process.env.MARKAI_SQLITE_PATH?.trim() || path.join(process.cwd(), ".data", "markai.sqlite");

const getLocalDatabase = () => {
  if (localDatabase) return localDatabase;

  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filename: string) => DatabaseLike;
  };
  localDatabase = new DatabaseSync(databasePath);
  localDatabase.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS user_installed_tools (
      user_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      version TEXT NOT NULL,
      installed_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, tool_id)
    );

    CREATE TABLE IF NOT EXISTS session_enabled_tools (
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      enabled_at INTEGER NOT NULL,
      PRIMARY KEY (session_id, tool_id),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_session_enabled_tools_user_session
      ON session_enabled_tools(user_id, session_id);
  `);
  return localDatabase;
};

export const listInstalledToolIds = async (userId: string): Promise<string[]> => {
  if (!isCloudMode()) {
    return getLocalDatabase()
      .prepare("SELECT tool_id FROM user_installed_tools WHERE user_id = ? ORDER BY installed_at")
      .all(userId)
      .map((row: any) => String(row.tool_id));
  }

  const rows = await getDb()
    .select({ toolId: userInstalledTools.toolId })
    .from(userInstalledTools)
    .where(eq(userInstalledTools.userId, userId));
  return rows.map((row) => row.toolId);
};

export const installTool = async (userId: string, toolId: string, version: string) => {
  if (!isCloudMode()) {
    getLocalDatabase()
      .prepare(
        `INSERT INTO user_installed_tools (user_id, tool_id, version, installed_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, tool_id) DO UPDATE SET version = excluded.version`,
      )
      .run(userId, toolId, version, Date.now());
    return;
  }

  await getDb()
    .insert(userInstalledTools)
    .values({ toolId, userId, version })
    .onConflictDoUpdate({
      set: { version },
      target: [userInstalledTools.userId, userInstalledTools.toolId],
    });
};

export const uninstallTool = async (userId: string, toolId: string) => {
  if (!isCloudMode()) {
    const database = getLocalDatabase();
    database
      .prepare("DELETE FROM session_enabled_tools WHERE user_id = ? AND tool_id = ?")
      .run(userId, toolId);
    database
      .prepare("DELETE FROM user_installed_tools WHERE user_id = ? AND tool_id = ?")
      .run(userId, toolId);
    return;
  }

  const database = getDb();
  await database
    .delete(sessionEnabledTools)
    .where(and(eq(sessionEnabledTools.userId, userId), eq(sessionEnabledTools.toolId, toolId)));
  await database
    .delete(userInstalledTools)
    .where(and(eq(userInstalledTools.userId, userId), eq(userInstalledTools.toolId, toolId)));
};

export const listSessionEnabledToolIds = async (userId: string, sessionId: string) => {
  if (!isCloudMode()) {
    return getLocalDatabase()
      .prepare(
        "SELECT tool_id FROM session_enabled_tools WHERE user_id = ? AND session_id = ? ORDER BY enabled_at",
      )
      .all(userId, sessionId)
      .map((row: any) => String(row.tool_id));
  }

  const rows = await getDb()
    .select({ toolId: sessionEnabledTools.toolId })
    .from(sessionEnabledTools)
    .where(
      and(eq(sessionEnabledTools.userId, userId), eq(sessionEnabledTools.sessionId, sessionId)),
    );
  return rows.map((row) => row.toolId);
};

export const replaceSessionEnabledTools = async (
  userId: string,
  sessionId: string,
  toolIds: string[],
) => {
  if (!isCloudMode()) {
    const database = getLocalDatabase();
    database
      .prepare("DELETE FROM session_enabled_tools WHERE user_id = ? AND session_id = ?")
      .run(userId, sessionId);
    const insert = database.prepare(
      `INSERT INTO session_enabled_tools (user_id, session_id, tool_id, enabled_at)
       VALUES (?, ?, ?, ?)`,
    );
    for (const toolId of toolIds) insert.run(userId, sessionId, toolId, Date.now());
    return;
  }

  const database = getDb();
  await database
    .delete(sessionEnabledTools)
    .where(
      and(eq(sessionEnabledTools.userId, userId), eq(sessionEnabledTools.sessionId, sessionId)),
    );
  if (toolIds.length > 0) {
    await database.insert(sessionEnabledTools).values(
      toolIds.map((toolId) => ({
        sessionId,
        toolId,
        userId,
      })),
    );
  }
};
