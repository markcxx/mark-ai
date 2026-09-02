import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloudMode } from "@/lib/env";
import {
  deleteStoredFile,
  getStoredAvatarUrl,
  getStoredFile,
  getStoredFileUsage,
  getStoredObjectSize,
  isStoredFileQuotaUnlimited,
  markStoredFileReady,
} from "@/lib/storage/file-storage";
import { formatStorageLimitMb, storageLimits } from "@/lib/storage/limits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const file = await getStoredFile(id, userId);
  if (!file) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  try {
    const actualSize = await getStoredObjectSize(file);
    const maxBytes =
      file.kind === "avatar" ? storageLimits.maxAvatarBytes : storageLimits.maxFileBytes;
    if (actualSize <= 0 || actualSize > maxBytes || actualSize !== file.size) {
      await deleteStoredFile(file);
      return NextResponse.json(
        {
          error:
            actualSize > maxBytes
              ? `单个文件不能超过 ${formatStorageLimitMb(maxBytes)} MB`
              : "上传文件校验失败",
        },
        { status: actualSize > maxBytes ? 413 : 400 },
      );
    }

    if (file.kind === "attachment" && !(await isStoredFileQuotaUnlimited(userId))) {
      const usage = await getStoredFileUsage(userId);
      const nextUsageSize = usage.size + (file.status === "ready" ? 0 : actualSize);
      if (nextUsageSize > storageLimits.maxStorageBytes) {
        await deleteStoredFile(file);
        return NextResponse.json(
          {
            error: `附件总容量不能超过 ${formatStorageLimitMb(storageLimits.maxStorageBytes)} MB，请删除旧文件后重试`,
          },
          { status: 413 },
        );
      }
    }

    await markStoredFileReady(file);

    let url: string | undefined;
    if (file.kind === "avatar") {
      url = getStoredAvatarUrl(file);
      if (isCloudMode()) {
        await getDb()
          .update(users)
          .set({ avatar: url, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }
    }
    return NextResponse.json({
      file: {
        contentType: file.contentType,
        id: file.id,
        kind: file.kind,
        name: file.originalName,
        size: file.size,
        url,
      },
    });
  } catch (error) {
    console.error("File upload complete error:", error);
    return NextResponse.json({ error: "未找到已上传的文件" }, { status: 400 });
  }
}
