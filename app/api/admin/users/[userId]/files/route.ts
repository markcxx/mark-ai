import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi, getPagination } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { getDb } from "@/lib/db";
import { storageFiles } from "@/lib/db/schema";
import { deleteStoredFile, toStoredFileRecord } from "@/lib/storage/file-storage";

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const { userId } = await context.params;
  const { limit, offset, page } = getPagination(request, 50);
  const db = getDb();
  const [files, totals] = await Promise.all([
    db
      .select()
      .from(storageFiles)
      .where(
        and(
          eq(storageFiles.userId, userId),
          eq(storageFiles.kind, "attachment"),
          eq(storageFiles.status, "ready"),
        ),
      )
      .orderBy(desc(storageFiles.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${storageFiles.size}), 0)::bigint`,
        value: count(),
      })
      .from(storageFiles)
      .where(
        and(
          eq(storageFiles.userId, userId),
          eq(storageFiles.kind, "attachment"),
          eq(storageFiles.status, "ready"),
        ),
      ),
  ]);
  return NextResponse.json({
    files,
    page,
    total: totals[0]?.value || 0,
    totalBytes: Number(totals[0]?.bytes || 0),
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { userId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string").slice(0, 100)
    : [];
  if (!ids.length) return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  const files = await getDb()
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.userId, userId), inArray(storageFiles.id, ids)));
  for (const file of files) await deleteStoredFile(toStoredFileRecord(file));
  await writeAdminAudit({
    action: "file.batch_delete",
    actorUserId: admin.id,
    metadata: { count: files.length, userId },
    request,
    targetId: userId,
    targetType: "user_files",
  });
  return NextResponse.json({ deleted: files.length, ok: true });
}
