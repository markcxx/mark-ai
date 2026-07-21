import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers as getNextHeaders } from "next/headers";

import { isActiveBan } from "@/lib/auth-access";
import { getDb } from "@/lib/db";
import { adminAuditLogs, users } from "@/lib/db/schema";
import { isBootstrapAdminEmail } from "@/lib/registration";

export type CurrentAdmin = {
  email: string;
  id: string;
  role: string;
};

export const getCurrentAdmin = async (
  requestHeaders?: Headers,
): Promise<CurrentAdmin | undefined> => {
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({
    headers: requestHeaders || (await getNextHeaders()),
    query: { disableCookieCache: true },
  });
  if (!session?.user?.id) return undefined;

  const [user] = await getDb()
    .select({
      banned: users.banned,
      banExpires: users.banExpires,
      email: users.email,
      emailVerified: users.emailVerified,
      id: users.id,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user) return undefined;
  const activeBan = isActiveBan(user);
  const banExpired = Boolean(user.banned && !activeBan);
  if (activeBan) return undefined;
  if (banExpired) {
    await getDb()
      .update(users)
      .set({ banned: false, banExpires: null, banReason: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  const bootstrapAdmin = isBootstrapAdminEmail(user.email);
  if (!bootstrapAdmin && (user.role !== "admin" || !user.emailVerified)) return undefined;
  if (bootstrapAdmin && (user.role !== "admin" || !user.emailVerified)) {
    await getDb()
      .update(users)
      .set({ emailVerified: true, role: "admin", updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return { email: user.email, id: user.id, role: "admin" };
};

export const writeAdminAudit = async ({
  action,
  actorUserId,
  metadata,
  request,
  targetId,
  targetType,
}: {
  action: string;
  actorUserId: string;
  metadata?: Record<string, unknown>;
  request?: Request;
  targetId?: string;
  targetType: string;
}) => {
  await getDb()
    .insert(adminAuditLogs)
    .values({
      action,
      actorUserId,
      id: randomUUID(),
      ipAddress:
        request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request?.headers.get("x-real-ip") ||
        undefined,
      metadata,
      targetId,
      targetType,
      userAgent: request?.headers.get("user-agent") || undefined,
    });
};
