import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { wordDocumentSources } from "@/lib/db/schema";
import { isLocalMode } from "@/lib/env";

import type { WordDocumentJob } from "./types";

type DatabaseLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    get: (...values: unknown[]) => unknown;
    run: (...values: unknown[]) => unknown;
  };
};

type LocalWordDocumentRow = {
  generated_file_id: string | null;
  state: string;
};

export type WordDocumentSourceSelector = {
  documentId?: string;
  generatedFileId?: string;
  sessionId: string;
  userId: string;
};

const require = createRequire(import.meta.url);
let localDatabase: DatabaseLike | undefined;

const getLocalDatabasePath = () =>
  process.env.MARKAI_SQLITE_PATH?.trim() || path.join(process.cwd(), ".data", "markai.sqlite");

const getLocalDatabase = () => {
  if (localDatabase) return localDatabase;
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filename: string) => DatabaseLike;
  };
  const databasePath = getLocalDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  localDatabase = new DatabaseSync(databasePath);
  localDatabase.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS word_document_sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      generated_file_id TEXT,
      title TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_word_document_sources_user_session_updated
      ON word_document_sources(user_id, session_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_word_document_sources_generated_file
      ON word_document_sources(generated_file_id);
  `);
  return localDatabase;
};

const cloneJob = (job: WordDocumentJob) => structuredClone(job);

const parseStoredJob = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("已保存的 Word 可编辑数据无效");
  }
  const job = value as WordDocumentJob;
  if (
    typeof job.id !== "string" ||
    typeof job.title !== "string" ||
    !Array.isArray(job.blocks) ||
    !Array.isArray(job.outline) ||
    !Array.isArray(job.completedSectionIds) ||
    !job.sectionBlockIds ||
    typeof job.sectionBlockIds !== "object"
  ) {
    throw new Error("已保存的 Word 可编辑数据不完整");
  }
  return cloneJob(job);
};

const getErrorChain = (error: unknown) => {
  const messages: string[] = [];
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const item = current as { cause?: unknown; code?: unknown; message?: unknown };
    if (typeof item.message === "string") messages.push(item.message);
    if (item.code !== undefined) messages.push(String(item.code));
    current = item.cause;
  }
  return messages.join("\n");
};

const toWordSourceReadError = (error: unknown) => {
  const detail = getErrorChain(error);
  console.error("Word editable source read failed:", error);
  if (
    detail.includes("42P01") ||
    (detail.includes("word_document_sources") && detail.includes("does not exist"))
  ) {
    return new Error("Word 可编辑源存储尚未初始化，请先应用数据库迁移 0008 后重试");
  }
  if (error instanceof Error && error.message.startsWith("已保存的 Word")) return error;
  return new Error("读取 Word 可编辑源失败，请稍后重试");
};

const saveLocalWordDocumentSource = (
  job: WordDocumentJob,
  context: { generatedFileId: string; sessionId: string; userId: string },
) => {
  const now = Date.now();
  getLocalDatabase()
    .prepare(
      `INSERT INTO word_document_sources
        (id, user_id, session_id, generated_file_id, title, revision, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         generated_file_id = excluded.generated_file_id,
         title = excluded.title,
         revision = excluded.revision,
         state = excluded.state,
         updated_at = excluded.updated_at
       WHERE user_id = excluded.user_id AND session_id = excluded.session_id`,
    )
    .run(
      job.id,
      context.userId,
      context.sessionId,
      context.generatedFileId,
      job.title,
      job.revision,
      JSON.stringify(job),
      job.createdAt,
      now,
    );
};

const openLocalWordDocumentSource = (selector: WordDocumentSourceSelector) => {
  const database = getLocalDatabase();
  let row: LocalWordDocumentRow | undefined;
  if (selector.documentId) {
    row = database
      .prepare(
        `SELECT generated_file_id, state FROM word_document_sources
         WHERE id = ? AND user_id = ? AND session_id = ? LIMIT 1`,
      )
      .get(selector.documentId, selector.userId, selector.sessionId) as
      LocalWordDocumentRow | undefined;
  } else if (selector.generatedFileId) {
    row = database
      .prepare(
        `SELECT generated_file_id, state FROM word_document_sources
         WHERE generated_file_id = ? AND user_id = ? AND session_id = ?
         ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(selector.generatedFileId, selector.userId, selector.sessionId) as
      LocalWordDocumentRow | undefined;
  } else {
    row = database
      .prepare(
        `SELECT generated_file_id, state FROM word_document_sources
         WHERE user_id = ? AND session_id = ? ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(selector.userId, selector.sessionId) as LocalWordDocumentRow | undefined;
  }
  if (!row) return undefined;
  const job = parseStoredJob(JSON.parse(row.state));
  job.generatedFileId = row.generated_file_id || job.generatedFileId;
  return job;
};

export const saveWordDocumentSource = async (
  job: WordDocumentJob,
  context: { generatedFileId: string; sessionId: string; userId: string },
) => {
  if (isLocalMode()) {
    saveLocalWordDocumentSource(job, context);
    return;
  }
  await getDb()
    .insert(wordDocumentSources)
    .values({
      generatedFileId: context.generatedFileId,
      id: job.id,
      revision: job.revision,
      sessionId: context.sessionId,
      state: job,
      title: job.title,
      userId: context.userId,
    })
    .onConflictDoUpdate({
      set: {
        generatedFileId: context.generatedFileId,
        revision: job.revision,
        state: job,
        title: job.title,
        updatedAt: new Date(),
      },
      target: wordDocumentSources.id,
    });
};

export const openWordDocumentSource = async (selector: WordDocumentSourceSelector) => {
  try {
    if (isLocalMode()) return openLocalWordDocumentSource(selector);
    const conditions = [
      eq(wordDocumentSources.userId, selector.userId),
      eq(wordDocumentSources.sessionId, selector.sessionId),
    ];
    if (selector.documentId) conditions.push(eq(wordDocumentSources.id, selector.documentId));
    else if (selector.generatedFileId) {
      conditions.push(eq(wordDocumentSources.generatedFileId, selector.generatedFileId));
    }
    const [row] = await getDb()
      .select({
        generatedFileId: wordDocumentSources.generatedFileId,
        state: wordDocumentSources.state,
      })
      .from(wordDocumentSources)
      .where(and(...conditions))
      .orderBy(desc(wordDocumentSources.updatedAt))
      .limit(1);
    if (!row) return undefined;
    const job = parseStoredJob(row.state);
    job.generatedFileId = row.generatedFileId || job.generatedFileId;
    return job;
  } catch (error) {
    throw toWordSourceReadError(error);
  }
};
