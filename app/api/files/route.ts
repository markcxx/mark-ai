import { and, count, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { storageFiles, users } from "@/lib/db/schema";
import { storageLimits } from "@/lib/storage/limits";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const db = getDb();
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const fileFilter = and(
    eq(storageFiles.userId, userId),
    eq(storageFiles.kind, "attachment"),
    eq(storageFiles.status, "ready"),
  );
  const [files, usageRows] = await Promise.all([
    db
      .select({
        contentType: storageFiles.contentType,
        createdAt: storageFiles.createdAt,
        id: storageFiles.id,
        name: storageFiles.originalName,
        size: storageFiles.size,
      })
      .from(storageFiles)
      .where(fileFilter)
      .orderBy(desc(storageFiles.createdAt)),
    db
      .select({
        count: count(storageFiles.id),
        size: sql<number>`coalesce(sum(${storageFiles.size}), 0)`,
      })
      .from(storageFiles)
      .where(fileFilter),
  ]);

  const [usage] = usageRows;
  const limited = user.role !== "admin";

  return NextResponse.json({
    files: files.map((file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
    })),
    limits: {
      maxFileBytes: storageLimits.maxFileBytes,
      maxFileCount: limited ? storageLimits.maxFileCount : null,
      maxStorageBytes: limited ? storageLimits.maxStorageBytes : null,
    },
    usage: {
      count: Number(usage?.count || 0),
      size: Number(usage?.size || 0),
    },
  });
}
