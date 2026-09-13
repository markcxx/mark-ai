import { boolean, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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

export const modelPresentations = pgTable(
  "model_presentations",
  {
    provider: text("provider").notNull(),
    modelId: text("model_id").notNull(),
    displayName: text("display_name").notNull().default(""),
    description: text("description").notNull().default(""),
    isNew: boolean("is_new").notNull().default(false),
    newUntil: timestamp("new_until", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    newRevision: text("new_revision").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.provider, table.modelId] })],
);
