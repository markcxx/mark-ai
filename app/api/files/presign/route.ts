import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import {
  createStoredFileRecord,
  createStoredFileUploadUrl,
  getStoredFileBucket,
  getStoredFileUsage,
  isStoredFileQuotaUnlimited,
} from "@/lib/storage/file-storage";
import { isAllowedUploadType, storageLimits } from "@/lib/storage/limits";

export const runtime = "nodejs";

const safeExtension = (name: string) => {
  const match = name.toLowerCase().match(/\.[a-z0-9]{1,10}$/);
  return match?.[0] || "";
};

export async function POST(request: Request) {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 240) : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = Number(body?.size);
  const kind = body?.kind === "avatar" ? "avatar" : "attachment";
  if (
    !name ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    !isAllowedUploadType(contentType, kind)
  ) {
    return NextResponse.json({ error: "文件名称、大小或格式不受支持" }, { status: 400 });
  }

  const maxBytes = kind === "avatar" ? storageLimits.maxAvatarBytes : storageLimits.maxFileBytes;
  if (size > maxBytes) {
    return NextResponse.json(
      { error: `文件不能超过 ${Math.ceil(maxBytes / 1024 / 1024)} MB` },
      { status: 413 },
    );
  }

  let unlimited: boolean;
  try {
    unlimited = await isStoredFileQuotaUnlimited(userId);
  } catch (error) {
    if (error instanceof Error && error.message === "用户不存在") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

  if (!unlimited && kind !== "avatar") {
    const usage = await getStoredFileUsage(userId);
    if (usage.count >= storageLimits.maxFileCount) {
      return NextResponse.json({ error: "文件数量已达到上限" }, { status: 413 });
    }
    if (usage.size + size > storageLimits.maxStorageBytes) {
      return NextResponse.json({ error: "存储空间不足，请删除旧文件后重试" }, { status: 413 });
    }
  }

  const id = randomUUID();
  const bucket = getStoredFileBucket(kind);
  const objectKey =
    kind === "avatar"
      ? `avatars/${userId}/${id}${safeExtension(name)}`
      : `users/${userId}/attachments/${id}${safeExtension(name)}`;

  const file = await createStoredFileRecord({
    bucket,
    contentType,
    id,
    kind,
    objectKey,
    originalName: name,
    size,
    status: "pending",
    userId,
  });

  return NextResponse.json({
    file: { contentType, id, kind, name, size },
    uploadUrl: await createStoredFileUploadUrl(file),
  });
}
