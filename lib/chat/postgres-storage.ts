import { randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, notInArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";

import {
  ChatRevisionConflictError,
  type MessageWriteOptions,
  type StorageAdapter,
} from "./storage-adapter";
import type {
  ChatSession,
  FileAttachment,
  Message,
  MessageSegment,
  MessageVariant,
  WebSearchState,
} from "./types";

const DEFAULT_SESSION_TITLE = "新对话";

const getTemporarySessionTitle = (message?: string) => {
  const title = message?.trim().replace(/\s+/g, " ").slice(0, 80);
  return title || DEFAULT_SESSION_TITLE;
};

const toSession = (row: typeof chatSessions.$inferSelect, messageCount: number): ChatSession => ({
  createdAt: new Date(row.createdAt).getTime(),
  favorite: row.favorite ?? false,
  id: row.id,
  messageCount,
  model: row.model ?? undefined,
  provider: row.provider ?? undefined,
  revision: row.revision,
  title: row.title || DEFAULT_SESSION_TITLE,
  updatedAt: new Date(row.updatedAt).getTime(),
});

const toMessage = (row: typeof chatMessages.$inferSelect): Message => ({
  activeVariantId: row.activeVariantId ?? undefined,
  content: row.content || "",
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
  role: row.role === "user" ? "user" : "model",
  segments: (row.segments as MessageSegment[] | null) ?? undefined,
  attachments: (row.attachments as FileAttachment[] | null) ?? undefined,
  totalTokens: row.totalTokens ?? undefined,
  tokenUsageSource:
    row.tokenUsageSource === "provider" || row.tokenUsageSource === "estimated"
      ? row.tokenUsageSource
      : undefined,
  variants: (row.variants as MessageVariant[] | null) ?? undefined,
  webSearch: (row.webSearch as WebSearchState[] | null) ?? undefined,
});

const getStorageMessageId = (sessionId: string, messageId: string) =>
  messageId.startsWith(`${sessionId}:`) ? messageId : `${sessionId}:${messageId}`;

const toStoredMessageValues = (
  sessionId: string,
  message: Message,
  position: number,
  createdAt: Date,
) => ({
  activeVariantId: message.activeVariantId || null,
  attachments: message.attachments || null,
  content: message.content,
  createdAt: message.createdAt ? new Date(message.createdAt) : createdAt,
  generationDuration: message.generationDuration || null,
  id: getStorageMessageId(sessionId, message.id),
  inputTokens: message.inputTokens ?? null,
  interrupted: message.interrupted ?? false,
  model: message.model || null,
  outputTokens: message.outputTokens ?? null,
  position,
  provider: message.provider || null,
  reasoning: message.reasoning || null,
  reasoningDuration: message.reasoningDuration || null,
  role: message.role,
  segments: message.segments || null,
  sessionId,
  tokenUsageSource: message.tokenUsageSource || null,
  totalTokens: message.totalTokens ?? null,
  variants: message.variants || null,
  webSearch: message.webSearch || null,
});

const messageConflictUpdate = {
  activeVariantId: sql`excluded.active_variant_id`,
  attachments: sql`excluded.attachments`,
  content: sql`excluded.content`,
  createdAt: sql`excluded.created_at`,
  generationDuration: sql`excluded.generation_duration`,
  inputTokens: sql`excluded.input_tokens`,
  interrupted: sql`excluded.interrupted`,
  model: sql`excluded.model`,
  outputTokens: sql`excluded.output_tokens`,
  position: sql`excluded.position`,
  provider: sql`excluded.provider`,
  reasoning: sql`excluded.reasoning`,
  reasoningDuration: sql`excluded.reasoning_duration`,
  role: sql`excluded.role`,
  segments: sql`excluded.segments`,
  sessionId: sql`excluded.session_id`,
  tokenUsageSource: sql`excluded.token_usage_source`,
  totalTokens: sql`excluded.total_tokens`,
  variants: sql`excluded.variants`,
  webSearch: sql`excluded.web_search`,
};

export class PostgresStorage implements StorageAdapter {
  private async claimRevision(sessionId: string, userId: string, expectedRevision?: number) {
    const db = getDb();
    const conditions = [eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)];
    if (expectedRevision !== undefined) {
      conditions.push(eq(chatSessions.revision, expectedRevision));
    }

    const [claimed] = await db
      .update(chatSessions)
      .set({
        revision: sql`${chatSessions.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning({ revision: chatSessions.revision });
    if (claimed) return claimed.revision;

    const [current] = await db
      .select({ revision: chatSessions.revision })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);
    if (!current) throw new Error("Session not found or access denied");
    throw new ChatRevisionConflictError(current.revision);
  }

  async listChatSessions(userId?: string) {
    if (!userId) throw new Error("userId is required in cloud mode");

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
    if (!userId) throw new Error("userId is required in cloud mode");

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
    if (!userId) throw new Error("userId is required in cloud mode");

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
    if (!userId) throw new Error("userId is required in cloud mode");

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
    if (!userId) throw new Error("userId is required in cloud mode");

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
    if (!userId) throw new Error("userId is required in cloud mode");

    const db = getDb();
    await db
      .update(chatSessions)
      .set({ favorite, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));

    return this.getChatSession(sessionId, userId);
  }

  async deleteChatSession(sessionId: string, userId?: string) {
    if (!userId) throw new Error("userId is required in cloud mode");

    const db = getDb();
    await db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
  }

  async replaceChatMessages(
    sessionId: string,
    messages: Message[],
    userId?: string,
    options: Pick<MessageWriteOptions, "expectedRevision"> = {},
  ) {
    if (!userId) throw new Error("userId is required in cloud mode");

    const db = getDb();
    const now = new Date();
    await this.claimRevision(sessionId, userId, options.expectedRevision);

    const storedMessages = messages.map((message, index) =>
      toStoredMessageValues(sessionId, message, index, new Date(now.getTime() + index)),
    );
    const deleteMessages = db.delete(chatMessages).where(
      storedMessages.length > 0
        ? and(
            eq(chatMessages.sessionId, sessionId),
            notInArray(
              chatMessages.id,
              storedMessages.map((message) => message.id),
            ),
          )
        : eq(chatMessages.sessionId, sessionId),
    );
    if (messages.length > 0) {
      const upsertMessages = db.insert(chatMessages).values(storedMessages).onConflictDoUpdate({
        target: chatMessages.id,
        set: messageConflictUpdate,
      });
      await db.batch([upsertMessages, deleteMessages]);
    } else {
      await deleteMessages;
    }

    return {
      messages: await this.getChatMessages(sessionId, userId),
      session: await this.getChatSession(sessionId, userId),
    };
  }

  async upsertChatMessage(
    sessionId: string,
    message: Message,
    userId?: string,
    options: MessageWriteOptions = {},
  ) {
    if (!userId) throw new Error("userId is required in cloud mode");

    const db = getDb();
    await this.claimRevision(sessionId, userId, options.expectedRevision);
    const storageMessageId = getStorageMessageId(sessionId, message.id);
    const [existing] = await db
      .select({ createdAt: chatMessages.createdAt, position: chatMessages.position })
      .from(chatMessages)
      .where(and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.id, storageMessageId)))
      .limit(1);
    const [last] = await db
      .select({ position: sql<number>`coalesce(max(${chatMessages.position}), -1)` })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId));
    const requestedPosition = options.position;
    const position =
      Number.isInteger(requestedPosition) && Number(requestedPosition) >= 0
        ? Number(requestedPosition)
        : (existing?.position ?? Number(last?.position ?? -1) + 1);
    const values = toStoredMessageValues(
      sessionId,
      message,
      position,
      existing?.createdAt || new Date(),
    );

    await db.insert(chatMessages).values(values).onConflictDoUpdate({
      target: chatMessages.id,
      set: messageConflictUpdate,
    });

    const [storedMessage] = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.sessionId, sessionId), eq(chatMessages.id, storageMessageId)))
      .limit(1);
    return {
      message: storedMessage ? toMessage(storedMessage) : undefined,
      session: await this.getChatSession(sessionId, userId),
    };
  }

  async deleteChatMessage(
    sessionId: string,
    messageId: string,
    userId?: string,
    options: Pick<MessageWriteOptions, "expectedRevision"> = {},
  ) {
    if (!userId) throw new Error("userId is required in cloud mode");

    await this.claimRevision(sessionId, userId, options.expectedRevision);
    await getDb()
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          eq(chatMessages.id, getStorageMessageId(sessionId, messageId)),
        ),
      );
    return { session: await this.getChatSession(sessionId, userId) };
  }
}
