import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { PlanConfig } from "@/lib/plans";
export const membershipPlans = pgTable("membership_plans", {
  id: text("id").primaryKey(),
  config: jsonb("config").$type<PlanConfig>().notNull(),
  revision: text("revision").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const userMemberships = pgTable("user_memberships", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  tier: text("tier").notNull().default("free"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
