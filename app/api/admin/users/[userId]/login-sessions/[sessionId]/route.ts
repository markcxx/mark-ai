import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { getDb } from "@/lib/db";
import { authSessions } from "@/lib/db/schema";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string; userId: string }> },
) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { sessionId, userId } = await context.params;
  await getDb()
    .delete(authSessions)
    .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)));
  await writeAdminAudit({
    action: "user.session.revoke",
    actorUserId: admin.id,
    request,
    targetId: sessionId,
    targetType: "auth_session",
  });
  return NextResponse.json({ ok: true });
}
