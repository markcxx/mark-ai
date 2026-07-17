import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { storageFiles } from "@/lib/db/schema";
import { deleteR2Object } from "@/lib/storage/r2";

export async function DELETE(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { fileId } = await context.params;
  const db = getDb();
  const [file] = await db
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId)))
    .limit(1);
  if (!file) return NextResponse.json({ ok: true });
  await deleteR2Object(file.bucket, file.objectKey).catch(() => undefined);
  await db.delete(storageFiles).where(eq(storageFiles.id, file.id));
  return NextResponse.json({ ok: true });
}
