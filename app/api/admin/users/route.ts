import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi, getPagination } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { getDb } from "@/lib/db";
import { authSessions, chatSessions, storageFiles, users, waitlistEntries } from "@/lib/db/schema";
import { isBootstrapAdminEmail } from "@/lib/registration";
import { deleteStoredFile, toStoredFileRecord } from "@/lib/storage/file-storage";

export async function GET(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const { limit, offset, page, searchParams } = getPagination(request);
  const search = searchParams.get("search")?.trim() || "";
  const role = searchParams.get("role")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const direction = searchParams.get("direction") === "asc" ? asc : desc;
  const filters = [
    role ? eq(users.role, role) : undefined,
    status === "banned" ? eq(users.banned, true) : undefined,
    status === "active" ? or(eq(users.banned, false), sql`${users.banned} is null`) : undefined,
    search
      ? or(
          ilike(users.email, `%${search}%`),
          ilike(users.fullName, `%${search}%`),
          ilike(users.username, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters) : undefined;
  const db = getDb();
  const [baseRows, totalRows] = await Promise.all([
    db
      .select({
        age: users.age,
        avatar: users.avatar,
        banned: users.banned,
        createdAt: users.createdAt,
        email: users.email,
        emailVerified: users.emailVerified,
        fullName: users.fullName,
        id: users.id,
        role: users.role,
        username: users.username,
      })
      .from(users)
      .where(where)
      .orderBy(direction(users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(users).where(where),
  ]);
  const userIds = baseRows.map((user) => user.id);
  if (!userIds.length) {
    return NextResponse.json({ page, total: totalRows[0]?.value || 0, users: [] });
  }

  const [fileRows, sessionRows, activityRows] = await Promise.all([
    db
      .select({
        bytes: sql<number>`coalesce(sum(${storageFiles.size}), 0)::bigint`,
        count: count(),
        userId: storageFiles.userId,
      })
      .from(storageFiles)
      .where(
        and(
          inArray(storageFiles.userId, userIds),
          eq(storageFiles.kind, "attachment"),
          eq(storageFiles.status, "ready"),
        ),
      )
      .groupBy(storageFiles.userId),
    db
      .select({ count: count(), userId: chatSessions.userId })
      .from(chatSessions)
      .where(inArray(chatSessions.userId, userIds))
      .groupBy(chatSessions.userId),
    db
      .select({
        lastActiveAt: sql<Date>`max(${authSessions.updatedAt})`,
        userId: authSessions.userId,
      })
      .from(authSessions)
      .where(inArray(authSessions.userId, userIds))
      .groupBy(authSessions.userId),
  ]);

  const filesByUser = new Map(fileRows.map((row) => [row.userId, row]));
  const sessionsByUser = new Map(sessionRows.map((row) => [row.userId, row]));
  const activityByUser = new Map(activityRows.map((row) => [row.userId, row]));
  const rows = baseRows.map((user) => ({
    ...user,
    fileBytes: Number(filesByUser.get(user.id)?.bytes || 0),
    fileCount: Number(filesByUser.get(user.id)?.count || 0),
    lastActiveAt: activityByUser.get(user.id)?.lastActiveAt || null,
    sessionCount: Number(sessionsByUser.get(user.id)?.count || 0),
  }));

  return NextResponse.json({ page, total: totalRows[0]?.value || 0, users: rows });
}

export async function PATCH(request: Request) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const body = await request.json().catch(() => ({}));
  const action = body.action === "ban" || body.action === "unban" ? body.action : undefined;
  const ids: string[] = Array.isArray(body.ids)
    ? Array.from(
        new Set<string>(body.ids.filter((id: unknown): id is string => typeof id === "string")),
      ).slice(0, 100)
    : [];
  if (!action || !ids.length) {
    return NextResponse.json({ error: "批量操作参数无效" }, { status: 400 });
  }

  const selectedUsers = await getDb()
    .select({ email: users.email, id: users.id })
    .from(users)
    .where(inArray(users.id, ids));
  const editableUsers = selectedUsers.filter(
    (user) => action === "unban" || (user.id !== admin.id && !isBootstrapAdminEmail(user.email)),
  );
  const editableIds = editableUsers.map((user) => user.id);
  if (editableIds.length) {
    await getDb()
      .update(users)
      .set({
        banned: action === "ban",
        banExpires: null,
        banReason:
          action === "ban"
            ? typeof body.reason === "string" && body.reason.trim()
              ? body.reason.trim().slice(0, 300)
              : "管理员批量封禁"
            : null,
        updatedAt: new Date(),
      })
      .where(inArray(users.id, editableIds));
  }
  await writeAdminAudit({
    action: action === "ban" ? "user.batch_ban" : "user.batch_unban",
    actorUserId: admin.id,
    metadata: {
      requested: ids.length,
      skipped: ids.length - editableIds.length,
      updated: editableIds.length,
    },
    request,
    targetType: "users",
  });
  return NextResponse.json({
    ok: true,
    skipped: ids.length - editableIds.length,
    updated: editableIds.length,
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
  if (!ids.length) return NextResponse.json({ error: "请选择用户" }, { status: 400 });

  const selectedUsers = await getDb()
    .select({ email: users.email, id: users.id })
    .from(users)
    .where(inArray(users.id, ids));
  const deletableUsers = selectedUsers.filter(
    (user) => user.id !== admin.id && !isBootstrapAdminEmail(user.email),
  );
  const deletableIds = deletableUsers.map((user) => user.id);
  let filesDeleted = 0;
  let waitlistEntriesDeleted = 0;

  if (deletableIds.length) {
    const files = await getDb()
      .select()
      .from(storageFiles)
      .where(inArray(storageFiles.userId, deletableIds));
    for (const file of files) await deleteStoredFile(toStoredFileRecord(file));
    filesDeleted = files.length;
    const relatedWaitlist = await getDb()
      .select({ id: waitlistEntries.id })
      .from(waitlistEntries)
      .where(inArray(waitlistEntries.registeredUserId, deletableIds));
    if (relatedWaitlist.length) {
      await getDb()
        .delete(waitlistEntries)
        .where(inArray(waitlistEntries.registeredUserId, deletableIds));
    }
    waitlistEntriesDeleted = relatedWaitlist.length;
    await getDb().delete(users).where(inArray(users.id, deletableIds));
  }

  await writeAdminAudit({
    action: "user.batch_delete",
    actorUserId: admin.id,
    metadata: {
      deleted: deletableIds.length,
      filesDeleted,
      requested: ids.length,
      skipped: selectedUsers.length - deletableIds.length,
      waitlistEntriesDeleted,
    },
    request,
    targetType: "users",
  });
  return NextResponse.json({
    deleted: deletableIds.length,
    ok: true,
    skipped: selectedUsers.length - deletableIds.length,
  });
}
