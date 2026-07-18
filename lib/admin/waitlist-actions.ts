import { eq } from "drizzle-orm";

import { writeAdminAudit } from "@/lib/admin/auth";
import { deliverTrackedEmail } from "@/lib/admin/email-delivery";
import { getDb } from "@/lib/db";
import { waitlistEntries, waitlistInvitations } from "@/lib/db/schema";
import { sendWaitlistInvitationEmail } from "@/lib/email";
import { createWaitlistInvitation, getWaitlistInviteTtlHours } from "@/lib/registration";

type WaitlistAction = "approve" | "reject" | "resend" | "revoke";

export class WaitlistActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const processWaitlistAction = async ({
  action,
  actorUserId,
  entryId,
  request,
  reviewNote = "",
}: {
  action: WaitlistAction;
  actorUserId: string;
  entryId: string;
  request: Request;
  reviewNote?: string;
}) => {
  const [entry] = await getDb()
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.id, entryId))
    .limit(1);
  if (!entry) throw new WaitlistActionError("申请不存在", 404);

  const normalizedNote = reviewNote.trim().slice(0, 500);
  const now = new Date();
  if (action === "reject") {
    await getDb()
      .update(waitlistEntries)
      .set({
        reviewNote: normalizedNote || null,
        reviewedAt: now,
        reviewedBy: actorUserId,
        status: "rejected",
        updatedAt: now,
      })
      .where(eq(waitlistEntries.id, entryId));
    await writeAdminAudit({
      action: "waitlist.reject",
      actorUserId,
      metadata: { reviewNote: normalizedNote },
      request,
      targetId: entryId,
      targetType: "waitlist",
    });
    return { ok: true as const };
  }

  if (action === "revoke") {
    await getDb()
      .update(waitlistInvitations)
      .set({ revokedAt: now })
      .where(eq(waitlistInvitations.waitlistEntryId, entryId));
    await getDb()
      .update(waitlistEntries)
      .set({ status: "approved", updatedAt: now })
      .where(eq(waitlistEntries.id, entryId));
    await writeAdminAudit({
      action: "waitlist.revoke",
      actorUserId,
      request,
      targetId: entryId,
      targetType: "waitlist",
    });
    return { ok: true as const };
  }

  const { invitation, token } = await createWaitlistInvitation({
    createdBy: actorUserId,
    entryId,
  });
  await getDb()
    .update(waitlistEntries)
    .set({
      reviewNote: normalizedNote || entry.reviewNote,
      reviewedAt: now,
      reviewedBy: actorUserId,
      status: "invited",
      updatedAt: now,
    })
    .where(eq(waitlistEntries.id, entryId));

  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const inviteUrl = `${appUrl}/register?invite=${encodeURIComponent(token)}`;
  const delivery = await deliverTrackedEmail({
    dedupeKey: `waitlist-invitation:${invitation.id}`,
    eventType: "waitlist_invitation",
    recipient: entry.email,
    send: () =>
      sendWaitlistInvitationEmail({
        email: entry.email,
        expiresInHours: getWaitlistInviteTtlHours(),
        url: inviteUrl,
      }),
  });
  if (delivery.sent) {
    await getDb()
      .update(waitlistInvitations)
      .set({ sentAt: new Date() })
      .where(eq(waitlistInvitations.id, invitation.id));
  }
  await writeAdminAudit({
    action: action === "approve" ? "waitlist.approve" : "waitlist.resend",
    actorUserId,
    metadata: { emailSent: delivery.sent, expiresAt: invitation.expiresAt.toISOString() },
    request,
    targetId: entryId,
    targetType: "waitlist",
  });
  return { emailSent: delivery.sent, ok: true as const };
};
