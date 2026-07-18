import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { emailDeliveries } from "@/lib/db/schema";

export const deliverTrackedEmail = async ({
  dedupeKey,
  eventType,
  recipient,
  send,
}: {
  dedupeKey: string;
  eventType: string;
  recipient: string;
  send: () => Promise<boolean>;
}) => {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.dedupeKey, dedupeKey))
    .limit(1);
  if (existing?.status === "sent") return { sent: true };

  const deliveryId = existing?.id || randomUUID();
  if (!existing) {
    await db.insert(emailDeliveries).values({
      dedupeKey,
      eventType,
      id: deliveryId,
      recipient,
    });
  }

  try {
    const sent = await send();
    await db
      .update(emailDeliveries)
      .set({
        attempts: (existing?.attempts || 0) + 1,
        lastError: sent ? null : "SMTP 未配置",
        sentAt: sent ? new Date() : null,
        status: sent ? "sent" : "failed",
        updatedAt: new Date(),
      })
      .where(eq(emailDeliveries.id, deliveryId));
    return { sent };
  } catch (error) {
    await db
      .update(emailDeliveries)
      .set({
        attempts: (existing?.attempts || 0) + 1,
        lastError: error instanceof Error ? error.message.slice(0, 500) : "邮件发送失败",
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(emailDeliveries.id, deliveryId));
    return { sent: false };
  }
};
