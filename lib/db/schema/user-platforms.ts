import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import type { ClientPlatform } from "@/lib/client-platform";
import { users } from "./users";

export const userPlatforms = pgTable(
  "user_platforms",
  {
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    platform: text("platform").$type<ClientPlatform>().notNull(),
    appVersion: text("app_version"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.platform] }),
    index("idx_user_platforms_platform_user").on(table.platform, table.userId),
  ],
);
