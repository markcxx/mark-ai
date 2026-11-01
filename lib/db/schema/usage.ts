import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

// One row per billable model call on a site model: new messages, retries and
// regenerations alike. Credits are charged here, never derived from the
// message table, where a retry overwrites the previous reply.
export const modelUsageEvents = pgTable(
  "model_usage_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelKey: text("model_key").notNull(),
    tier: text("tier").notNull(),
    credits: integer("credits").notNull(),
    /** Counts against the shared free allowance instead of credits. */
    free: integer("free").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("model_usage_events_user_created").on(table.userId, table.createdAt)],
);
