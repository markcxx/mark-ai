import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { deliverTrackedEmail } from "@/lib/admin/email-delivery";
import { enforceRateLimit } from "@/lib/api/security";
import { getDb } from "@/lib/db";
import { users, waitlistEntries } from "@/lib/db/schema";
import { sendWaitlistAdminNotification } from "@/lib/email";
import { getAdminEmails, getRegistrationMode, normalizeEmail } from "@/lib/registration";

export const dynamic = "force-dynamic";

const genericResponse = () =>
  NextResponse.json({
    message: "如果该邮箱可以加入等候名单，我们会向你发送后续通知。",
    ok: true,
  });

export async function POST(request: NextRequest) {
  if (getRegistrationMode() !== "waitlist") {
    return NextResponse.json({ error: "当前未开放等候名单申请" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 60) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  }

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = enforceRateLimit({
    key: `${address}:${email}`,
    limit: 3,
    scope: "waitlist-application",
    windowMs: 60 * 60_000,
  });
  if (limited) return limited;

  const db = getDb();
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) return genericResponse();

  const [existingEntry] = await db
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.email, email))
    .limit(1);
  if (existingEntry && !["cancelled", "rejected", "expired"].includes(existingEntry.status)) {
    return genericResponse();
  }

  const now = new Date();
  const entryId = existingEntry?.id || randomUUID();
  if (existingEntry) {
    await db
      .update(waitlistEntries)
      .set({
        fullName: fullName || null,
        message: message || null,
        requestedAt: now,
        reviewNote: null,
        reviewedAt: null,
        reviewedBy: null,
        status: "pending",
        updatedAt: now,
      })
      .where(eq(waitlistEntries.id, entryId));
  } else {
    await db.insert(waitlistEntries).values({
      email,
      fullName: fullName || null,
      id: entryId,
      message: message || null,
    });
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length) {
    await deliverTrackedEmail({
      dedupeKey: `waitlist-application:${entryId}:${now.getTime()}`,
      eventType: "waitlist_application",
      recipient: adminEmails.join(","),
      send: () =>
        sendWaitlistAdminNotification({
          applicantEmail: email,
          applicantName: fullName || undefined,
          message: message || undefined,
          recipients: adminEmails,
        }),
    });
  }

  return genericResponse();
}
