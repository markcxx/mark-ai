import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import {
  getStoredFileUsage,
  isStoredFileQuotaUnlimited,
  listStoredAttachmentFiles,
} from "@/lib/storage/file-storage";
import { storageLimits } from "@/lib/storage/limits";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let files: Awaited<ReturnType<typeof listStoredAttachmentFiles>>;
  let usage: Awaited<ReturnType<typeof getStoredFileUsage>>;
  let unlimited: boolean;
  try {
    [files, usage, unlimited] = await Promise.all([
      listStoredAttachmentFiles(userId),
      getStoredFileUsage(userId),
      isStoredFileQuotaUnlimited(userId),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "用户不存在") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.json({
    files: files.map((file) => ({
      contentType: file.contentType,
      createdAt: file.createdAt.toISOString(),
      id: file.id,
      name: file.originalName,
      size: file.size,
    })),
    limits: {
      maxFileBytes: storageLimits.maxFileBytes,
      maxFileCount: unlimited ? null : storageLimits.maxFileCount,
      maxStorageBytes: unlimited ? null : storageLimits.maxStorageBytes,
    },
    usage,
  });
}
