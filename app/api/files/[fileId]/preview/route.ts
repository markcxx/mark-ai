import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { storageFiles } from "@/lib/db/schema";
import { createPreviewUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { fileId } = await context.params;
  const [file] = await getDb()
    .select()
    .from(storageFiles)
    .where(
      and(
        eq(storageFiles.id, fileId),
        eq(storageFiles.userId, userId),
        eq(storageFiles.status, "ready"),
      ),
    )
    .limit(1);

  if (!file) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  return NextResponse.redirect(
    await createPreviewUrl(file.bucket, file.objectKey, file.contentType, file.originalName),
  );
}
