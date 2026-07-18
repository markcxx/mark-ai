import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import {
  ChatRevisionConflictError,
  type MessageWriteOptions,
  type StorageAdapter,
} from "./storage-adapter";
import type { ChatSession, Message } from "./types";

type PreparedStatementLike = {
  all: (...values: unknown[]) => unknown[];
  get: (...values: unknown[]) => unknown;
  run: (...values: unknown[]) => unknown;
};

type DatabaseLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => PreparedStatementLike;
};

const require = createRequire(import.meta.url);
const DEFAULT_SESSION_TITLE = "新对话";

const getTemporarySessionTitle = (message?: string) => {
  const title = message?.trim().replace(/\s+/g, " ").slice(0, 80);
  return title || DEFAULT_SESSION_TITLE;
};

let db: DatabaseLike | undefined;

const getDatabasePath = () =>
  process.env.MARKAI_SQLITE_PATH?.trim() || path.join(process.cwd(), ".data", "markai.sqlite");

const ensureDatabase = () => {
  if (db) return db;

  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filename: string) => DatabaseLike;
  };

  db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      favorite INTEGER,
      model TEXT,
      provider TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      interrupted INTEGER,
      reasoning TEXT,
      reasoning_duration INTEGER,
      generation_duration INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      token_usage_source TEXT,
      active_variant_id TEXT,
      variants TEXT,
      web_search TEXT,
      segments TEXT,
      attachments TEXT,
      model TEXT,
      provider TEXT,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_position
      ON chat_messages(session_id, position);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
      ON chat_sessions(updated_at DESC);
  `);

  const sessionColumns = new Set(
    db
      .prepare("PRAGMA table_info(chat_sessions)")
      .all()
      .map((row: any) => String(row.name)),
  );
  const ensureSessionColumn = (name: string, definition: string) => {
    if (sessionColumns.has(name)) return;
    db!.exec(`ALTER TABLE chat_sessions ADD COLUMN ${definition}`);
  };

  ensureSessionColumn("favorite", "favorite INTEGER");
  ensureSessionColumn("revision", "revision INTEGER NOT NULL DEFAULT 0");

  const columns = new Set(
    db
      .prepare("PRAGMA table_info(chat_messages)")
      .all()
      .map((row: any) => String(row.name)),
  );
  const ensureColumn = (name: string, definition: string) => {
    if (columns.has(name)) return;
    db!.exec(`ALTER TABLE chat_messages ADD COLUMN ${definition}`);
  };

  ensureColumn("interrupted", "interrupted INTEGER");
  ensureColumn("generation_duration", "generation_duration INTEGER");
  ensureColumn("input_tokens", "input_tokens INTEGER");
  ensureColumn("output_tokens", "output_tokens INTEGER");
  ensureColumn("total_tokens", "total_tokens INTEGER");
  ensureColumn("token_usage_source", "token_usage_source TEXT");
  ensureColumn("active_variant_id", "active_variant_id TEXT");
  ensureColumn("variants", "variants TEXT");
  ensureColumn("web_search", "web_search TEXT");
  ensureColumn("segments", "segments TEXT");
  ensureColumn("attachments", "attachments TEXT");

  return db;
};

const parseJsonValue = <T>(value: unknown): T | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const toSession = (row: any): ChatSession => ({
  createdAt: Number(row.created_at),
  favorite: Boolean(row.favorite),
  id: String(row.id),
  messageCount: Number(row.message_count || 0),
  model: row.model || undefined,
  provider: row.provider || undefined,
  revision: Number(row.revision || 0),
  title: String(row.title || DEFAULT_SESSION_TITLE),
  updatedAt: Number(row.updated_at),
});

const toMessage = (row: any): Message => ({
  activeVariantId: row.active_variant_id || undefined,
  attachments: parseJsonValue(row.attachments),
  content: String(row.content || ""),
  createdAt: typeof row.created_at === "number" ? row.created_at : undefined,
  generationDuration:
    typeof row.generation_duration === "number" ? row.generation_duration : undefined,
  id: String(row.id),
  inputTokens: typeof row.input_tokens === "number" ? row.input_tokens : undefined,
  interrupted: Boolean(row.interrupted),
  model: row.model || undefined,
  outputTokens: typeof row.output_tokens === "number" ? row.output_tokens : undefined,
  provider: row.provider || undefined,
  reasoning: row.reasoning || undefined,
  reasoningDuration:
    typeof row.reasoning_duration === "number" ? row.reasoning_duration : undefined,
  role: row.role === "user" ? "user" : "model",
  segments: parseJsonValue(row.segments),
  totalTokens: typeof row.total_tokens === "number" ? row.total_tokens : undefined,
  tokenUsageSource:
    row.token_usage_source === "provider" || row.token_usage_source === "estimated"
      ? row.token_usage_source
      : undefined,
  variants: parseJsonValue(row.variants),
  webSearch: parseJsonValue(row.web_search),
});

const getStorageMessageId = (sessionId: string, messageId: string) =>
  messageId.startsWith(`${sessionId}:`) ? messageId : `${sessionId}:${messageId}`;

const prepareMessageUpsert = (database: DatabaseLike) =>
  database.prepare(
    `INSERT INTO chat_messages
      (
        id,
        session_id,
        role,
        content,
        interrupted,
        reasoning,
        reasoning_duration,
        generation_duration,
        input_tokens,
        output_tokens,
        total_tokens,
        token_usage_source,
        active_variant_id,
        variants,
        web_search,
        segments,
        attachments,
        model,
        provider,
        position,
        created_at
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       session_id = excluded.session_id,
       role = excluded.role,
       content = excluded.content,
       interrupted = excluded.interrupted,
       reasoning = excluded.reasoning,
       reasoning_duration = excluded.reasoning_duration,
       generation_duration = excluded.generation_duration,
       input_tokens = excluded.input_tokens,
       output_tokens = excluded.output_tokens,
       total_tokens = excluded.total_tokens,
       token_usage_source = excluded.token_usage_source,
       active_variant_id = excluded.active_variant_id,
       variants = excluded.variants,
       web_search = excluded.web_search,
       segments = excluded.segments,
       attachments = excluded.attachments,
       model = excluded.model,
       provider = excluded.provider,
       position = excluded.position,
       created_at = excluded.created_at`,
  );

const runMessageUpsert = (
  insert: PreparedStatementLike,
  sessionId: string,
  message: Message,
  position: number,
  createdAt: number,
) => {
  const storageMessageId = getStorageMessageId(sessionId, message.id);
  insert.run(
    storageMessageId,
    sessionId,
    message.role,
    message.content,
    message.interrupted ? 1 : 0,
    message.reasoning || null,
    message.reasoningDuration || null,
    message.generationDuration || null,
    message.inputTokens ?? null,
    message.outputTokens ?? null,
    message.totalTokens ?? null,
    message.tokenUsageSource || null,
    message.activeVariantId || null,
    message.variants ? JSON.stringify(message.variants) : null,
    message.webSearch ? JSON.stringify(message.webSearch) : null,
    message.segments ? JSON.stringify(message.segments) : null,
    message.attachments ? JSON.stringify(message.attachments) : null,
    message.model || null,
    message.provider || null,
    position,
    message.createdAt || createdAt,
  );
  return storageMessageId;
};

const assertSessionRevision = (
  database: DatabaseLike,
  sessionId: string,
  expectedRevision?: number,
) => {
  const row = database.prepare("SELECT revision FROM chat_sessions WHERE id = ?").get(sessionId) as
    { revision?: number } | undefined;
  if (!row) throw new Error("Session not found");
  const currentRevision = Number(row.revision || 0);
  if (expectedRevision !== undefined && currentRevision !== expectedRevision) {
    throw new ChatRevisionConflictError(currentRevision);
  }
  return currentRevision;
};

const bumpSessionRevision = (database: DatabaseLike, sessionId: string) => {
  database
    .prepare("UPDATE chat_sessions SET revision = revision + 1, updated_at = ? WHERE id = ?")
    .run(Date.now(), sessionId);
};

export class SqliteStorage implements StorageAdapter {
  listChatSessions() {
    const rows = ensureDatabase()
      .prepare(
        `
        SELECT
          s.id,
          s.title,
          s.favorite,
          s.model,
          s.provider,
          s.revision,
          s.created_at,
          s.updated_at,
          COUNT(m.id) AS message_count
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY s.favorite DESC, s.updated_at DESC
      `,
      )
      .all();

    return rows.map(toSession);
  }

  createChatSession({
    initialMessage,
    model,
    provider,
    title,
  }: {
    initialMessage?: string;
    model?: string;
    provider?: string;
    title?: string;
  }) {
    const now = Date.now();
    const id = randomUUID();

    ensureDatabase()
      .prepare(
        `INSERT INTO chat_sessions (id, title, favorite, model, provider, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        title?.trim() || getTemporarySessionTitle(initialMessage),
        0,
        model || null,
        provider || null,
        now,
        now,
      );

    return this.getChatSession(id)!;
  }

  getChatSession(sessionId: string) {
    const row = ensureDatabase()
      .prepare(
        `
        SELECT
          s.id,
          s.title,
          s.favorite,
          s.model,
          s.provider,
          s.revision,
          s.created_at,
          s.updated_at,
          COUNT(m.id) AS message_count
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON m.session_id = s.id
        WHERE s.id = ?
        GROUP BY s.id
      `,
      )
      .get(sessionId);

    return row ? toSession(row) : undefined;
  }

  getChatMessages(sessionId: string) {
    const rows = ensureDatabase()
      .prepare(
        `SELECT
          id,
          role,
          content,
          interrupted,
          reasoning,
          reasoning_duration,
          generation_duration,
          input_tokens,
          output_tokens,
          total_tokens,
          token_usage_source,
          active_variant_id,
          variants,
          web_search,
          segments,
          attachments,
          model,
          provider,
          created_at
         FROM chat_messages
         WHERE session_id = ?
         ORDER BY position ASC, created_at ASC`,
      )
      .all(sessionId);

    return rows.map(toMessage);
  }

  updateChatSessionTitle(sessionId: string, title: string) {
    const nextTitle = title.trim().slice(0, 40);
    if (!nextTitle) return this.getChatSession(sessionId);

    ensureDatabase()
      .prepare("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?")
      .run(nextTitle, Date.now(), sessionId);

    return this.getChatSession(sessionId);
  }

  updateChatSessionFavorite(sessionId: string, favorite: boolean) {
    ensureDatabase()
      .prepare("UPDATE chat_sessions SET favorite = ?, updated_at = ? WHERE id = ?")
      .run(favorite ? 1 : 0, Date.now(), sessionId);

    return this.getChatSession(sessionId);
  }

  deleteChatSession(sessionId: string) {
    ensureDatabase().prepare("DELETE FROM chat_sessions WHERE id = ?").run(sessionId);
  }

  replaceChatMessages(
    sessionId: string,
    messages: Message[],
    _userId?: string,
    options: Pick<MessageWriteOptions, "expectedRevision"> = {},
  ) {
    const database = ensureDatabase();
    const now = Date.now();

    database.exec("BEGIN IMMEDIATE");
    try {
      assertSessionRevision(database, sessionId, options.expectedRevision);
      const insert = prepareMessageUpsert(database);

      const storedMessageIds: string[] = [];
      messages.forEach((message, index) => {
        const storageMessageId = runMessageUpsert(insert, sessionId, message, index, now + index);
        storedMessageIds.push(storageMessageId);
      });

      if (storedMessageIds.length > 0) {
        const placeholders = storedMessageIds.map(() => "?").join(", ");
        database
          .prepare(
            `DELETE FROM chat_messages
             WHERE session_id = ? AND id NOT IN (${placeholders})`,
          )
          .run(sessionId, ...storedMessageIds);
      } else {
        database.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
      }

      bumpSessionRevision(database, sessionId);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    return {
      messages: this.getChatMessages(sessionId),
      session: this.getChatSession(sessionId),
    };
  }

  upsertChatMessage(
    sessionId: string,
    message: Message,
    _userId?: string,
    options: MessageWriteOptions = {},
  ) {
    const database = ensureDatabase();
    const storageMessageId = getStorageMessageId(sessionId, message.id);

    database.exec("BEGIN IMMEDIATE");
    try {
      assertSessionRevision(database, sessionId, options.expectedRevision);
      const existing = database
        .prepare("SELECT position, created_at FROM chat_messages WHERE session_id = ? AND id = ?")
        .get(sessionId, storageMessageId) as { created_at?: number; position?: number } | undefined;
      const last = database
        .prepare(
          "SELECT COALESCE(MAX(position), -1) AS position FROM chat_messages WHERE session_id = ?",
        )
        .get(sessionId) as { position?: number } | undefined;
      const requestedPosition = options.position;
      const position =
        Number.isInteger(requestedPosition) && Number(requestedPosition) >= 0
          ? Number(requestedPosition)
          : Number(existing?.position ?? Number(last?.position ?? -1) + 1);

      runMessageUpsert(
        prepareMessageUpsert(database),
        sessionId,
        message,
        position,
        Number(existing?.created_at || Date.now()),
      );
      bumpSessionRevision(database, sessionId);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    return {
      message: this.getChatMessages(sessionId).find((item) => item.id === storageMessageId),
      session: this.getChatSession(sessionId),
    };
  }

  deleteChatMessage(
    sessionId: string,
    messageId: string,
    _userId?: string,
    options: Pick<MessageWriteOptions, "expectedRevision"> = {},
  ) {
    const database = ensureDatabase();
    const storageMessageId = getStorageMessageId(sessionId, messageId);

    database.exec("BEGIN IMMEDIATE");
    try {
      assertSessionRevision(database, sessionId, options.expectedRevision);
      const existing = database
        .prepare("SELECT id FROM chat_messages WHERE session_id = ? AND id = ?")
        .get(sessionId, storageMessageId);
      if (existing) {
        database
          .prepare("DELETE FROM chat_messages WHERE session_id = ? AND id = ?")
          .run(sessionId, storageMessageId);
        bumpSessionRevision(database, sessionId);
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    return { session: this.getChatSession(sessionId) };
  }
}
