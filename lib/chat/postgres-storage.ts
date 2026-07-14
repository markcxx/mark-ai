import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { chatMessages, chatSessions } from '@/lib/db/schema';

import type { StorageAdapter } from './storage-adapter';
import type { ChatSession, FileAttachment, Message, MessageSegment, WebSearchState } from './types';

const DEFAULT_SESSION_TITLE = '新对话';

const getTemporarySessionTitle = (message?: string) => {
  const title = message?.trim().replace(/\s+/g, ' ').slice(0, 80);
  return title || DEFAULT_SESSION_TITLE;
};

const toSession = (
  row: typeof chatSessions.$inferSelect,
  messageCount: number,
): ChatSession => ({
  createdAt: new Date(row.createdAt).getTime(),
  favorite: row.favorite ?? false,
  id: row.id,
  messageCount,
  model: row.model ?? undefined,
  provider: row.provider ?? undefined,
  title: row.title || DEFAULT_SESSION_TITLE,
  updatedAt: new Date(row.updatedAt).getTime(),
});

const toMessage = (row: typeof chatMessages.$inferSelect): Message => ({
  content: row.content || '',
  createdAt: row.createdAt ? new Date(row.createdAt).getTime() : undefined,
  generationDuration: row.generationDuration ?? undefined,
  id: row.id,
  inputTokens: row.inputTokens ?? undefined,
  interrupted: row.interrupted ?? false,
  model: row.model ?? undefined,
  outputTokens: row.outputTokens ?? undefined,
  provider: row.provider ?? undefined,
  reasoning: row.reasoning ?? undefined,
  reasoningDuration: row.reasoningDuration ?? undefined,
  role: row.role === 'user' ? 'user' : 'model',
  segments: (row.segments as MessageSegment[] | null) ?? undefined,
  attachments: (row.attachments as FileAttachment[] | null) ?? undefined,
  totalTokens: row.totalTokens ?? undefined,
  webSearch: (row.webSearch as WebSearchState[] | null) ?? undefined,
});

export class PostgresStorage implements StorageAdapter {
  async listChatSessions(userId?: string) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const db = getDb();
    const rows = await db
      .select({
        session: chatSessions,
        messageCount: count(chatMessages.id),
      })
      .from(chatSessions)
      .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
      .where(eq(chatSessions.userId, userId))
      .groupBy(chatSessions.id)
      .orderBy(desc(chatSessions.favorite), desc(chatSessions.updatedAt));

    return rows.map((r) => toSession(r.session, r.messageCount));
  }

  async createChatSession({
    initialMessage,
    model,
    provider,
    title,
    userId,
  }: {
    initialMessage?: string;
    model?: string;
    provider?: string;
    title?: string;
    userId?: string;
  }) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const db = getDb();
    const id = randomUUID();
    const now = new Date();

    await db.insert(chatSessions).values({
      id,
      userId,
      title: title?.trim() || getTemporarySessionTitle(initialMessage),
      favorite: false,
      model: model || null,
      provider: provider || null,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getChatSession(id, userId))!;
  }

  async getChatSession(sessionId: string, userId?: string) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const db = getDb();
    const rows = await db
      .select({
        session: chatSessions,
        messageCount: count(chatMessages.id),
      })
      .from(chatSessions)
      .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .groupBy(chatSessions.id);

    return rows[0] ? toSession(rows[0].session, rows[0].messageCount) : undefined;
  }

  async getChatMessages(sessionId: string, userId?: string) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const db = getDb();

    const sessionExists = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    if (!sessionExists.length) return [];

    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.position), asc(chatMessages.createdAt));

    return rows.map(toMessage);
  }

  async updateChatSessionTitle(sessionId: string, title: string, userId?: string) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const nextTitle = title.trim().slice(0, 40);
    if (!nextTitle) return this.getChatSession(sessionId, userId);

    const db = getDb();
    await db
      .update(chatSessions)
      .set({ title: nextTitle, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));

    return this.getChatSession(sessionId, userId);
  }

  async updateChatSessionFavorite(sessionId: string, favorite: boolean, userId?: string) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const db = getDb();
    await db
      .update(chatSessions)
      .set({ favorite, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));

    return this.getChatSession(sessionId, userId);
  }

  async deleteChatSession(sessionId: string, userId?: string) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const db = getDb();
    await db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  }

  async replaceChatMessages(sessionId: string, messages: Message[], userId?: string) {
    if (!userId) throw new Error('userId is required in cloud mode');

    const db = getDb();
    const now = new Date();

    const sessionExists = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    if (!sessionExists.length) {
      throw new Error('Session not found or access denied');
    }

    const deleteMessages = db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    const updateSession = db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));

    if (messages.length > 0) {
      const insertMessages = db.insert(chatMessages).values(
        messages.map((message, index) => ({
          id: message.id.startsWith(`${sessionId}:`)
            ? message.id
            : `${sessionId}:${index}:${message.id}`,
          sessionId,
          role: message.role,
          content: message.content,
          interrupted: message.interrupted ?? false,
          reasoning: message.reasoning || null,
          reasoningDuration: message.reasoningDuration || null,
          generationDuration: message.generationDuration || null,
          inputTokens: message.inputTokens || null,
          outputTokens: message.outputTokens || null,
          totalTokens: message.totalTokens || null,
          webSearch: message.webSearch || null,
          segments: message.segments || null,
          attachments: message.attachments || null,
          model: message.model || null,
          provider: message.provider || null,
          position: index,
          createdAt: message.createdAt ? new Date(message.createdAt) : new Date(now.getTime() + index),
        })),
      );
      await db.batch([deleteMessages, insertMessages, updateSession]);
    } else {
      await db.batch([deleteMessages, updateSession]);
    }

    return {
      messages: await this.getChatMessages(sessionId, userId),
      session: await this.getChatSession(sessionId, userId),
    };
  }
}
