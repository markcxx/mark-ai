import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { accounts, authSessions } from './auth';
import { chatSessions } from './chat';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().notNull(),
    username: text('username').unique(),
    email: text('email').unique().notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    avatar: text('avatar'),
    fullName: text('full_name'),
    role: text('role').default('user'),
    banned: boolean('banned'),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires', { withTimezone: true }),
    preference: jsonb('preference'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_created_at').on(table.createdAt),
  ],
);

export const userSettings = pgTable('user_settings', {
  id: text('id').primaryKey().notNull(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  general: jsonb('general'),
  languageModel: jsonb('language_model'),
  defaultModel: text('default_model'),
  defaultProvider: text('default_provider'),
  plugins: jsonb('plugins'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(authSessions),
  chatSessions: many(chatSessions),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));
