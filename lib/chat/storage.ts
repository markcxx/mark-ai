import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { ChatSession, Message } from './types';

type DatabaseLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...values: unknown[]) => unknown[];
    get: (...values: unknown[]) => unknown;
    run: (...values: unknown[]) => unknown;
  };
};

const require = createRequire(import.meta.url);
const DEFAULT_SESSION_TITLE = '新对话';

const getTemporarySessionTitle = (message?: string) => {
  const title = message?.trim().replace(/\s+/g, ' ').slice(0, 80);
  return title || DEFAULT_SESSION_TITLE;
};

let db: DatabaseLike | undefined;

const getDatabasePath = () =>
  process.env.MARKAI_SQLITE_PATH?.trim() ||
  path.join(process.cwd(), '.data', 'markai.sqlite');

const ensureDatabase = () => {
  if (db) return db;

  const dbPath = getDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const { DatabaseSync } = require('node:sqlite') as {
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
    db.prepare('PRAGMA table_info(chat_sessions)').all().map((row: any) => String(row.name)),
  );
  const ensureSessionColumn = (name: string, definition: string) => {
    if (sessionColumns.has(name)) return;
    db!.exec(`ALTER TABLE chat_sessions ADD COLUMN ${definition}`);
  };

  ensureSessionColumn('favorite', 'favorite INTEGER');

  const columns = new Set(
    db.prepare('PRAGMA table_info(chat_messages)').all().map((row: any) => String(row.name)),
  );
  const ensureColumn = (name: string, definition: string) => {
    if (columns.has(name)) return;
    db!.exec(`ALTER TABLE chat_messages ADD COLUMN ${definition}`);
  };

  ensureColumn('interrupted', 'interrupted INTEGER');
  ensureColumn('generation_duration', 'generation_duration INTEGER');
  ensureColumn('input_tokens', 'input_tokens INTEGER');
  ensureColumn('output_tokens', 'output_tokens INTEGER');
  ensureColumn('total_tokens', 'total_tokens INTEGER');
  ensureColumn('web_search', 'web_search TEXT');

  return db;
};

const parseJsonValue = <T>(value: unknown): T | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;

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
  title: String(row.title || DEFAULT_SESSION_TITLE),
  updatedAt: Number(row.updated_at),
});

const toMessage = (row: any): Message => ({
  content: String(row.content || ''),
  createdAt: typeof row.created_at === 'number' ? row.created_at : undefined,
  generationDuration:
    typeof row.generation_duration === 'number' ? row.generation_duration : undefined,
  id: String(row.id),
  inputTokens: typeof row.input_tokens === 'number' ? row.input_tokens : undefined,
  interrupted: Boolean(row.interrupted),
  model: row.model || undefined,
  outputTokens: typeof row.output_tokens === 'number' ? row.output_tokens : undefined,
  provider: row.provider || undefined,
  reasoning: row.reasoning || undefined,
  reasoningDuration:
    typeof row.reasoning_duration === 'number' ? row.reasoning_duration : undefined,
  role: row.role === 'user' ? 'user' : 'model',
  totalTokens: typeof row.total_tokens === 'number' ? row.total_tokens : undefined,
  webSearch: parseJsonValue(row.web_search),
});

export const listChatSessions = () => {
  const rows = ensureDatabase()
    .prepare(`
      SELECT
        s.id,
        s.title,
        s.favorite,
        s.model,
        s.provider,
        s.created_at,
        s.updated_at,
        COUNT(m.id) AS message_count
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.favorite DESC, s.updated_at DESC
    `)
    .all();

  return rows.map(toSession);
};

export const createChatSession = ({
  initialMessage,
  model,
  provider,
  title,
}: {
  initialMessage?: string;
  model?: string;
  provider?: string;
  title?: string;
}) => {
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

  return getChatSession(id)!;
};

export const getChatSession = (sessionId: string) => {
  const row = ensureDatabase()
    .prepare(`
      SELECT
        s.id,
        s.title,
        s.favorite,
        s.model,
        s.provider,
        s.created_at,
        s.updated_at,
        COUNT(m.id) AS message_count
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON m.session_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `)
    .get(sessionId);

  return row ? toSession(row) : undefined;
};

export const getChatMessages = (sessionId: string) => {
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
        web_search,
        model,
        provider,
        created_at
       FROM chat_messages
       WHERE session_id = ?
       ORDER BY position ASC, created_at ASC`,
    )
    .all(sessionId);

  return rows.map(toMessage);
};

export const updateChatSessionTitle = (sessionId: string, title: string) => {
  const nextTitle = title.trim().slice(0, 40);
  if (!nextTitle) return getChatSession(sessionId);

  ensureDatabase()
    .prepare('UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?')
    .run(nextTitle, Date.now(), sessionId);

  return getChatSession(sessionId);
};

export const updateChatSessionFavorite = (sessionId: string, favorite: boolean) => {
  ensureDatabase()
    .prepare('UPDATE chat_sessions SET favorite = ?, updated_at = ? WHERE id = ?')
    .run(favorite ? 1 : 0, Date.now(), sessionId);

  return getChatSession(sessionId);
};

export const deleteChatSession = (sessionId: string) => {
  ensureDatabase().prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);
};

export const replaceChatMessages = (sessionId: string, messages: Message[]) => {
  const database = ensureDatabase();
  const now = Date.now();

  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);

    const insert = database.prepare(
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
          web_search,
          model,
          provider,
          position,
          created_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    messages.forEach((message, index) => {
      const storageMessageId = message.id.startsWith(`${sessionId}:`)
        ? message.id
        : `${sessionId}:${index}:${message.id}`;

      insert.run(
        storageMessageId,
        sessionId,
        message.role,
        message.content,
        message.interrupted ? 1 : 0,
        message.reasoning || null,
        message.reasoningDuration || null,
        message.generationDuration || null,
        message.inputTokens || null,
        message.outputTokens || null,
        message.totalTokens || null,
        message.webSearch ? JSON.stringify(message.webSearch) : null,
        message.model || null,
        message.provider || null,
        index,
        message.createdAt || now + index,
      );
    });

    database
      .prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?')
      .run(Date.now(), sessionId);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    messages: getChatMessages(sessionId),
    session: getChatSession(sessionId),
  };
};
