import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { getDb } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";

const findSession = async (sessionId: string, userId: string) => {
  const [session] = await getDb()
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  return session;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string; userId: string }> },
) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { sessionId, userId } = await context.params;
  const session = await findSession(sessionId, userId);
  if (!session) return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  const messages = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.position));
  await writeAdminAudit({
    action: "conversation.view",
    actorUserId: admin.id,
    metadata: { userId },
    request,
    targetId: sessionId,
    targetType: "conversation",
  });
  return NextResponse.json({ messages, session });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string; userId: string }> },
) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { sessionId, userId } = await context.params;
  if (!(await findSession(sessionId, userId))) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  await getDb()
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
  await writeAdminAudit({
    action: "conversation.rename",
    actorUserId: admin.id,
    metadata: { title, userId },
    request,
    targetId: sessionId,
    targetType: "conversation",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string; userId: string }> },
) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { sessionId, userId } = await context.params;
  if (!(await findSession(sessionId, userId))) return NextResponse.json({ ok: true });
  await getDb().delete(chatSessions).where(eq(chatSessions.id, sessionId));
  await writeAdminAudit({
    action: "conversation.delete",
    actorUserId: admin.id,
    metadata: { userId },
    request,
    targetId: sessionId,
    targetType: "conversation",
  });
  return NextResponse.json({ ok: true });
}
