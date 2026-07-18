import { and, count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi, getPagination } from "@/lib/admin/api";
import { getDb } from "@/lib/db";
import { adminAuditLogs, users } from "@/lib/db/schema";

export async function GET(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const { limit, offset, page, searchParams } = getPagination(request, 50);
  const action = searchParams.get("action")?.trim() || "";
  const targetType = searchParams.get("targetType")?.trim() || "";
  const filters = [
    action ? eq(adminAuditLogs.action, action) : undefined,
    targetType ? eq(adminAuditLogs.targetType, targetType) : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;
  const db = getDb();
  const [logs, totals] = await Promise.all([
    db
      .select({
        action: adminAuditLogs.action,
        actorEmail: users.email,
        actorUserId: adminAuditLogs.actorUserId,
        createdAt: adminAuditLogs.createdAt,
        id: adminAuditLogs.id,
        ipAddress: adminAuditLogs.ipAddress,
        metadata: adminAuditLogs.metadata,
        targetId: adminAuditLogs.targetId,
        targetType: adminAuditLogs.targetType,
      })
      .from(adminAuditLogs)
      .leftJoin(users, eq(adminAuditLogs.actorUserId, users.id))
      .where(where)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(adminAuditLogs).where(where),
  ]);
  return NextResponse.json({ logs, page, total: totals[0]?.value || 0 });
}
