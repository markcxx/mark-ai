import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./users";

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: text("id").primaryKey().notNull(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    message: text("message"),
    status: text("status").default("pending").notNull(),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    registeredUserId: text("registered_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_waitlist_entries_email").on(table.email),
    index("idx_waitlist_entries_status_requested").on(table.status, table.requestedAt),
  ],
);

export const waitlistInvitations = pgTable(
  "waitlist_invitations",
  {
    id: text("id").primaryKey().notNull(),
    waitlistEntryId: text("waitlist_entry_id")
      .references(() => waitlistEntries.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_waitlist_invitations_token_hash").on(table.tokenHash),
    index("idx_waitlist_invitations_entry").on(table.waitlistEntryId, table.createdAt),
  ],
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey().notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_admin_audit_logs_actor_created").on(table.actorUserId, table.createdAt),
    index("idx_admin_audit_logs_target").on(table.targetType, table.targetId),
  ],
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: text("id").primaryKey().notNull(),
    eventType: text("event_type").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_email_deliveries_dedupe_key").on(table.dedupeKey),
    index("idx_email_deliveries_status_created").on(table.status, table.createdAt),
  ],
);

export const waitlistEntriesRelations = relations(waitlistEntries, ({ many, one }) => ({
  invitations: many(waitlistInvitations),
  registeredUser: one(users, {
    fields: [waitlistEntries.registeredUserId],
    references: [users.id],
    relationName: "waitlistRegisteredUser",
  }),
  reviewer: one(users, {
    fields: [waitlistEntries.reviewedBy],
    references: [users.id],
    relationName: "waitlistReviewer",
  }),
}));

export const waitlistInvitationsRelations = relations(waitlistInvitations, ({ one }) => ({
  creator: one(users, {
    fields: [waitlistInvitations.createdBy],
    references: [users.id],
  }),
  entry: one(waitlistEntries, {
    fields: [waitlistInvitations.waitlistEntryId],
    references: [waitlistEntries.id],
  }),
}));
