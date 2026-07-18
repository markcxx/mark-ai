import { primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { chatSessions } from "./chat";
import { users } from "./users";

export const userInstalledTools = pgTable(
  "user_installed_tools",
  {
    installedAt: timestamp("installed_at", { withTimezone: true }).defaultNow().notNull(),
    toolId: text("tool_id").notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    version: text("version").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.toolId] })],
);

export const sessionEnabledTools = pgTable(
  "session_enabled_tools",
  {
    enabledAt: timestamp("enabled_at", { withTimezone: true }).defaultNow().notNull(),
    sessionId: text("session_id")
      .references(() => chatSessions.id, { onDelete: "cascade" })
      .notNull(),
    toolId: text("tool_id").notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.toolId] })],
);

export const userInstalledToolsRelations = relations(userInstalledTools, ({ one }) => ({
  user: one(users, {
    fields: [userInstalledTools.userId],
    references: [users.id],
  }),
}));

export const sessionEnabledToolsRelations = relations(sessionEnabledTools, ({ one }) => ({
  session: one(chatSessions, {
    fields: [sessionEnabledTools.sessionId],
    references: [chatSessions.id],
  }),
  user: one(users, {
    fields: [sessionEnabledTools.userId],
    references: [users.id],
  }),
}));
