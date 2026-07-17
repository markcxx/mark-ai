import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { users } from "./users";

export const storageFiles = pgTable(
  "storage_files",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").unique().notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    kind: text("kind").default("attachment").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_storage_files_user_id").on(table.userId),
    index("idx_storage_files_user_status").on(table.userId, table.status),
  ],
);

export const storageFilesRelations = relations(storageFiles, ({ one }) => ({
  user: one(users, {
    fields: [storageFiles.userId],
    references: [users.id],
  }),
}));
