import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  createStoredFileRecord,
  deleteStoredFile,
  getStoredFileBucket,
  getStoredFileUsage,
  isStoredFileQuotaUnlimited,
  markStoredFileReady,
  writeStoredFileObject,
} from "@/lib/storage/file-storage";
import { storageLimits } from "@/lib/storage/limits";
import type { StoredFileRecord } from "@/lib/storage/local-file-storage";
import { putR2Object } from "@/lib/storage/r2";
import { isCloudMode } from "@/lib/env";

import type { GeneratedFile } from "./types";

const safeFileName = (value: string, fallback: string, extension: string) => {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const cleaned = value
    .trim()
    .replaceAll(/[/\\:*?"<>|\u0000-\u001f]/g, "-")
    .replaceAll(/\s+/g, " ")
    .replaceAll(/^\.+|\.+$/g, "")
    .slice(0, 100);
  const base = cleaned || fallback;
  return base.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? base
    : `${base}${normalizedExtension}`;
};

export const saveGeneratedFile = async ({
  bytes,
  contentType,
  extension,
  fallbackName,
  filename,
  userId,
}: {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  fallbackName: string;
  filename?: string;
  userId: string;
}): Promise<GeneratedFile> => {
  if (bytes.byteLength === 0) throw new Error("生成的文件为空");
  if (bytes.byteLength > storageLimits.maxFileBytes) {
    throw new Error("生成的文件超过当前大小限制");
  }

  const unlimited = await isStoredFileQuotaUnlimited(userId);
  if (!unlimited) {
    const usage = await getStoredFileUsage(userId);
    if (usage.count >= storageLimits.maxFileCount) throw new Error("文件数量已达到上限");
    if (usage.size + bytes.byteLength > storageLimits.maxStorageBytes) {
      throw new Error("存储空间不足，请删除旧文件后重试");
    }
  }

  const id = randomUUID();
  const name = safeFileName(filename || "", fallbackName, extension);
  const fileExtension = path.extname(name).toLowerCase();
  const objectKey = `users/${userId}/generated/${id}${fileExtension}`;
  const fileInput: Omit<StoredFileRecord, "createdAt" | "updatedAt"> = {
    bucket: getStoredFileBucket("attachment"),
    contentType,
    id,
    kind: "attachment",
    objectKey,
    originalName: name,
    size: bytes.byteLength,
    status: "pending",
    userId,
  };

  const file = await createStoredFileRecord(fileInput);
  try {
    if (isCloudMode()) {
      await putR2Object(file.bucket, file.objectKey, file.contentType, bytes);
    } else {
      await writeStoredFileObject(file, bytes);
    }
    await markStoredFileReady(file);
  } catch (error) {
    await deleteStoredFile(file).catch(() => undefined);
    throw error;
  }

  return {
    contentType,
    id,
    name,
    size: bytes.byteLength,
    url: `/api/files/${id}/download`,
  };
};
