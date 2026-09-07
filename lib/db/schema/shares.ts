import { jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { ConversationSnapshot } from "@/lib/chat/share-types";
import { chatSessions } from "./chat";
import { users } from "./users";

export const conversationShares = pgTable(
  "conversation_shares",
  {
    token: text("token").primaryKey().notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").$type<ConversationSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("idx_conversation_shares_session").on(table.sessionId)],
);
