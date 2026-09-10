import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const siteAnnouncements = pgTable("site_announcements", {
  id: text("id").primaryKey().notNull(),
  content: text("content").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  closable: boolean("closable").notNull().default(true),
  actionEnabled: boolean("action_enabled").notNull().default(false),
  actionLabel: text("action_label").notNull().default("了解更多"),
  actionUrl: text("action_url").notNull().default(""),
  revision: text("revision").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
