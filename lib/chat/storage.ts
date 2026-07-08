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
      reasoning TEXT,
      reasoning_duration INTEGER,
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

  return db;
};

const toSession = (row: any): ChatSession => ({
  createdAt: Number(row.created_at),
  id: String(row.id),
  messageCount: Number(row.message_count || 0),
  model: row.model || undefined,
  provider: row.provider || undefined,
  title: String(row.title || DEFAULT_SESSION_TITLE),
  updatedAt: Number(row.updated_at),
});

const toMessage = (row: any): Message => ({
  content: String(row.content || ''),
  id: String(row.id),
  model: row.model || undefined,
  provider: row.provider || undefined,
  reasoning: row.reasoning || undefined,
  reasoningDuration:
    typeof row.reasoning_duration === 'number' ? row.reasoning_duration : undefined,
  role: row.role === 'user' ? 'user' : 'model',
});

export const listChatSessions = () => {
  const rows = ensureDatabase()
    .prepare(`
      SELECT
        s.id,
        s.title,
        s.model,
        s.provider,
        s.created_at,
        s.updated_at,
        COUNT(m.id) AS message_count
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
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
      `INSERT INTO chat_sessions (id, title, model, provider, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      title?.trim() || getTemporarySessionTitle(initialMessage),
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
      `SELECT id, role, content, reasoning, reasoning_duration, model, provider
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
        (id, session_id, role, content, reasoning, reasoning_duration, model, provider, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        message.reasoning || null,
        message.reasoningDuration || null,
        message.model || null,
        message.provider || null,
        index,
        now + index,
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
