import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi, getPagination } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { processWaitlistAction } from "@/lib/admin/waitlist-actions";
import { getDb } from "@/lib/db";
import { users, waitlistEntries } from "@/lib/db/schema";

export async function GET(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const { limit, offset, page, searchParams } = getPagination(request);
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const filters = [
    status ? eq(waitlistEntries.status, status) : undefined,
    search
      ? or(
          ilike(waitlistEntries.email, `%${search}%`),
          ilike(waitlistEntries.fullName, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;
  const db = getDb();
  const [entries, totalRows] = await Promise.all([
    db
      .select({
        createdAt: waitlistEntries.createdAt,
        email: waitlistEntries.email,
        fullName: waitlistEntries.fullName,
        id: waitlistEntries.id,
        message: waitlistEntries.message,
        registeredUserId: waitlistEntries.registeredUserId,
        requestedAt: waitlistEntries.requestedAt,
        reviewNote: waitlistEntries.reviewNote,
        reviewedAt: waitlistEntries.reviewedAt,
        reviewerEmail: users.email,
        status: waitlistEntries.status,
        updatedAt: waitlistEntries.updatedAt,
      })
      .from(waitlistEntries)
      .leftJoin(users, eq(waitlistEntries.reviewedBy, users.id))
      .where(where)
      .orderBy(desc(waitlistEntries.requestedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(waitlistEntries).where(where),
  ]);
  return NextResponse.json({ entries, page, total: totalRows[0]?.value || 0 });
}

export async function PATCH(request: Request) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const body = await request.json().catch(() => ({}));
  const action = body.action === "approve" || body.action === "reject" ? body.action : undefined;
  const ids: string[] = Array.isArray(body.ids)
    ? Array.from(
        new Set<string>(body.ids.filter((id: unknown): id is string => typeof id === "string")),
      ).slice(0, 100)
    : [];
  if (!action || !ids.length) {
    return NextResponse.json({ error: "批量操作参数无效" }, { status: 400 });
  }

  const pendingRows = await getDb()
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(and(inArray(waitlistEntries.id, ids), eq(waitlistEntries.status, "pending")));
  let emailFailed = 0;
  let failed = 0;
  for (const entry of pendingRows) {
    try {
      const result = await processWaitlistAction({
        action,
        actorUserId: admin.id,
        entryId: entry.id,
        request,
      });
      if ("emailSent" in result && result.emailSent === false) emailFailed += 1;
    } catch {
      failed += 1;
    }
  }
  return NextResponse.json({
    emailFailed,
    failed,
    ok: true,
    processed: pendingRows.length - failed,
    skipped: ids.length - pendingRows.length,
  });
}

export async function DELETE(request: Request) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? Array.from(
        new Set<string>(body.ids.filter((id: unknown): id is string => typeof id === "string")),
      ).slice(0, 100)
    : [];
  if (!ids.length) return NextResponse.json({ error: "请选择等候名单记录" }, { status: 400 });

  const rows = await getDb()
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(inArray(waitlistEntries.id, ids));
  if (rows.length) {
    await getDb()
      .delete(waitlistEntries)
      .where(
        inArray(
          waitlistEntries.id,
          rows.map((row) => row.id),
        ),
      );
  }
  await writeAdminAudit({
    action: "waitlist.batch_delete",
    actorUserId: admin.id,
    metadata: { deleted: rows.length, requested: ids.length },
    request,
    targetType: "waitlist",
  });
  return NextResponse.json({ deleted: rows.length, ok: true });
}
