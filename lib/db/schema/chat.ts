import { index, integer, jsonb, pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { users } from './users';

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    favorite: boolean('favorite').default(false),
    model: text('model'),
    provider: text('provider'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_chat_sessions_user_id').on(table.userId),
    index('idx_chat_sessions_updated_at').on(table.updatedAt),
  ],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id').primaryKey().notNull(),
    sessionId: text('session_id')
      .references(() => chatSessions.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    interrupted: boolean('interrupted').default(false),
    reasoning: text('reasoning'),
    reasoningDuration: integer('reasoning_duration'),
    generationDuration: integer('generation_duration'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    webSearch: jsonb('web_search'),
    segments: jsonb('segments'),
    model: text('model'),
    provider: text('provider'),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_chat_messages_session_position').on(table.sessionId, table.position),
  ],
);

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));
