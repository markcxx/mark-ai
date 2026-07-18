import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { waitlistEntries, waitlistInvitations } from "@/lib/db/schema";

export type RegistrationMode = "closed" | "open" | "waitlist";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const getRegistrationMode = (): RegistrationMode => {
  const value = process.env.AUTH_REGISTRATION_MODE?.trim().toLowerCase();
  if (value === "closed" || value === "waitlist") return value;
  return "open";
};

export const getAdminEmails = () =>
  Array.from(
    new Set((process.env.AUTH_ADMIN_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean)),
  );

export const isBootstrapAdminEmail = (email: string) =>
  getAdminEmails().includes(normalizeEmail(email));

export const getWaitlistInviteTtlHours = () => {
  const value = Number(process.env.WAITLIST_INVITE_TTL_HOURS);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 24 * 30) : 72;
};

export const hashWaitlistToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const createWaitlistInvitation = async ({
  createdBy,
  entryId,
}: {
  createdBy: string;
  entryId: string;
}) => {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getWaitlistInviteTtlHours() * 60 * 60 * 1000);

  await db
    .update(waitlistInvitations)
    .set({ revokedAt: now })
    .where(
      and(
        eq(waitlistInvitations.waitlistEntryId, entryId),
        isNull(waitlistInvitations.usedAt),
        isNull(waitlistInvitations.revokedAt),
      ),
    );

  const [invitation] = await db
    .insert(waitlistInvitations)
    .values({
      createdBy,
      expiresAt,
      id: randomUUID(),
      tokenHash: hashWaitlistToken(token),
      waitlistEntryId: entryId,
    })
    .returning();

  return { invitation, token };
};

export const getValidWaitlistInvitation = async ({
  email,
  token,
}: {
  email?: string;
  token: string;
}) => {
  if (!token) return undefined;
  const rows = await getDb()
    .select({ entry: waitlistEntries, invitation: waitlistInvitations })
    .from(waitlistInvitations)
    .innerJoin(waitlistEntries, eq(waitlistInvitations.waitlistEntryId, waitlistEntries.id))
    .where(
      and(
        eq(waitlistInvitations.tokenHash, hashWaitlistToken(token)),
        gt(waitlistInvitations.expiresAt, new Date()),
        isNull(waitlistInvitations.usedAt),
        isNull(waitlistInvitations.revokedAt),
      ),
    )
    .orderBy(desc(waitlistInvitations.createdAt))
    .limit(1);
  const result = rows[0];
  if (!result) return undefined;
  if (email && result.entry.email !== normalizeEmail(email)) return undefined;
  if (!["approved", "invited"].includes(result.entry.status)) return undefined;
  return result;
};

export const canCreateUser = async ({
  email,
  invitationToken,
}: {
  email: string;
  invitationToken?: string;
}) => {
  const normalizedEmail = normalizeEmail(email);
  if (isBootstrapAdminEmail(normalizedEmail)) return true;
  const mode = getRegistrationMode();
  if (mode === "open") return true;
  if (mode === "closed" || !invitationToken) return false;
  return !!(await getValidWaitlistInvitation({ email: normalizedEmail, token: invitationToken }));
};
