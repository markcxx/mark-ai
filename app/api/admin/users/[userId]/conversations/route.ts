import { and, count, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi, getPagination } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { getDb } from "@/lib/db";
import { chatSessions } from "@/lib/db/schema";

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const { userId } = await context.params;
  const { limit, offset, page } = getPagination(request, 50);
  const db = getDb();
  const [sessions, totals] = await Promise.all([
    db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(chatSessions).where(eq(chatSessions.userId, userId)),
  ]);
  return NextResponse.json({ page, sessions, total: totals[0]?.value || 0 });
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { userId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string").slice(0, 100)
    : [];
  if (!ids.length) return NextResponse.json({ error: "请选择对话" }, { status: 400 });
  const selected = await getDb()
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), inArray(chatSessions.id, ids)));
  const selectedIds = selected.map((item) => item.id);
  if (selectedIds.length) {
    await getDb().delete(chatSessions).where(inArray(chatSessions.id, selectedIds));
  }
  await writeAdminAudit({
    action: "conversation.batch_delete",
    actorUserId: admin.id,
    metadata: { count: selectedIds.length, userId },
    request,
    targetId: userId,
    targetType: "user_conversations",
  });
  return NextResponse.json({ deleted: selectedIds.length, ok: true });
}
