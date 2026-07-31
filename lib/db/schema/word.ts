import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { chatSessions } from "./chat";
import { storageFiles } from "./files";
import { users } from "./users";

export const wordDocumentSources = pgTable(
  "word_document_sources",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: text("session_id")
      .references(() => chatSessions.id, { onDelete: "cascade" })
      .notNull(),
    generatedFileId: text("generated_file_id").references(() => storageFiles.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    revision: integer("revision").default(0).notNull(),
    state: jsonb("state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_word_document_sources_user_session_updated").on(
      table.userId,
      table.sessionId,
      table.updatedAt,
    ),
    index("idx_word_document_sources_generated_file").on(table.generatedFileId),
  ],
);

export const wordDocumentSourcesRelations = relations(wordDocumentSources, ({ one }) => ({
  file: one(storageFiles, {
    fields: [wordDocumentSources.generatedFileId],
    references: [storageFiles.id],
  }),
  session: one(chatSessions, {
    fields: [wordDocumentSources.sessionId],
    references: [chatSessions.id],
  }),
  user: one(users, {
    fields: [wordDocumentSources.userId],
    references: [users.id],
  }),
}));
