import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

export type PaymentOrderStatus = "pending" | "paid" | "expired" | "refunded";

// One row per checkout attempt. The amount and plan are fixed by the server at
// creation; provider data must match them exactly before the order is paid.
export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    months: integer("months").notNull().default(1),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<PaymentOrderStatus>().notNull().default("pending"),
    provider: text("provider").notNull(),
    providerOrderNumber: text("provider_order_number").notNull(),
    // The provider's trade number is globally unique so one payment can never
    // fulfill two orders.
    providerTransactionId: text("provider_transaction_id").unique(),
    paymentMethod: text("payment_method").notNull(),
    merchantId: text("merchant_id").notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    membershipExpiresAt: timestamp("membership_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payment_orders_provider_number").on(table.provider, table.providerOrderNumber),
    index("payment_orders_user_created").on(table.userId, table.createdAt),
  ],
);
