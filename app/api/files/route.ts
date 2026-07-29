import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import {
  deleteStoredFile,
  getStoredFilesByIds,
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

export async function DELETE(request: Request) {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rawFileIds: unknown[] = Array.isArray(body?.fileIds) ? body.fileIds : [];
  const fileIds = Array.from(
    new Set(rawFileIds.filter((id): id is string => typeof id === "string")),
  );
  if (
    fileIds.length === 0 ||
    fileIds.length > 50 ||
    fileIds.some((id) => id.length === 0 || id.length > 256)
  ) {
    return NextResponse.json({ error: "请选择 1 至 50 个有效文件" }, { status: 400 });
  }

  const files = (await getStoredFilesByIds(fileIds, userId)).filter(
    (file) => file.kind === "attachment",
  );
  for (const file of files) await deleteStoredFile(file);

  return NextResponse.json({ deletedIds: files.map((file) => file.id), ok: true });
}
