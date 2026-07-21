import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { storageFiles, users } from "@/lib/db/schema";
import { isCloudMode, isLocalMode } from "@/lib/env";

import {
  createLocalFileRecord,
  deleteLocalFileRecord,
  deleteLocalObject,
  getLocalFileRecord,
  getLocalFileUsage,
  getLocalObjectBytes,
  getLocalObjectSize,
  listLocalAttachmentFiles,
  markLocalFileReady,
  type StoredFileRecord,
  writeLocalObject,
} from "./local-file-storage";
import {
  createDownloadUrl,
  createPreviewUrl,
  createUploadUrl,
  deleteR2Object,
  getPublicObjectUrl,
  getR2Bucket,
  getR2ObjectBytes,
  headR2Object,
} from "./r2";

export type { StoredFileRecord } from "./local-file-storage";

export const toStoredFileRecord = (file: typeof storageFiles.$inferSelect): StoredFileRecord => ({
  ...file,
  kind: file.kind === "avatar" ? "avatar" : "attachment",
  status: file.status === "ready" ? "ready" : "pending",
});

export const listStoredAttachmentFiles = async (userId: string) => {
  if (isLocalMode()) return listLocalAttachmentFiles(userId);
  const files = await getDb()
    .select()
    .from(storageFiles)
    .where(
      and(
        eq(storageFiles.userId, userId),
        eq(storageFiles.kind, "attachment"),
        eq(storageFiles.status, "ready"),
      ),
    )
    .orderBy(desc(storageFiles.createdAt));
  return files.map(toStoredFileRecord);
};

export const getStoredFileUsage = async (userId: string) => {
  if (isLocalMode()) return getLocalFileUsage(userId);
  const [usage] = await getDb()
    .select({
      count: count(storageFiles.id),
      size: sql<number>`coalesce(sum(${storageFiles.size}), 0)`,
    })
    .from(storageFiles)
    .where(
      and(
        eq(storageFiles.userId, userId),
        eq(storageFiles.kind, "attachment"),
        eq(storageFiles.status, "ready"),
      ),
    );
  return { count: Number(usage?.count || 0), size: Number(usage?.size || 0) };
};

export const isStoredFileQuotaUnlimited = async (userId: string) => {
  if (isLocalMode()) return true;
  const [user] = await getDb()
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new Error("用户不存在");
  return user.role === "admin";
};

export const createStoredFileRecord = async (
  file: Omit<StoredFileRecord, "createdAt" | "updatedAt">,
) => {
  if (isLocalMode()) {
    createLocalFileRecord(file);
    return getLocalFileRecord(file.id, file.userId)!;
  }
  await getDb().insert(storageFiles).values(file);
  return (await getStoredFile(file.id, file.userId))!;
};

export const getStoredFileBucket = (kind: "attachment" | "avatar") =>
  isLocalMode() ? "local" : getR2Bucket(kind);

export const getStoredFile = async (id: string, userId: string, readyOnly = false) => {
  if (isLocalMode()) {
    const file = getLocalFileRecord(id, userId);
    return readyOnly && file?.status !== "ready" ? undefined : file;
  }
  const conditions = [eq(storageFiles.id, id), eq(storageFiles.userId, userId)];
  if (readyOnly) conditions.push(eq(storageFiles.status, "ready"));
  const [file] = await getDb()
    .select()
    .from(storageFiles)
    .where(and(...conditions))
    .limit(1);
  return file ? toStoredFileRecord(file) : undefined;
};

export const getStoredFilesByIds = async (ids: string[], userId: string) => {
  if (ids.length === 0) return [];
  if (isLocalMode()) {
    return ids
      .map((id) => getLocalFileRecord(id, userId))
      .filter((file): file is StoredFileRecord => file?.status === "ready");
  }
  const files = await getDb()
    .select()
    .from(storageFiles)
    .where(
      and(
        eq(storageFiles.userId, userId),
        eq(storageFiles.status, "ready"),
        inArray(storageFiles.id, ids),
      ),
    );
  return files.map(toStoredFileRecord);
};

export const markStoredFileReady = async (file: StoredFileRecord) => {
  if (isLocalMode()) {
    markLocalFileReady(file.id, file.userId);
    return;
  }
  await getDb()
    .update(storageFiles)
    .set({ status: "ready", updatedAt: new Date() })
    .where(and(eq(storageFiles.id, file.id), eq(storageFiles.userId, file.userId)));
};

export const deleteStoredFile = async (file: StoredFileRecord) => {
  if (isLocalMode()) {
    await deleteLocalObject(file).catch(() => undefined);
    deleteLocalFileRecord(file.id, file.userId);
    return;
  }
  await deleteR2Object(file.bucket, file.objectKey).catch(() => undefined);
  await getDb()
    .delete(storageFiles)
    .where(and(eq(storageFiles.id, file.id), eq(storageFiles.userId, file.userId)));
};

export const createStoredFileUploadUrl = async (file: StoredFileRecord) => {
  if (isLocalMode()) return `/api/files/${file.id}/content`;
  return createUploadUrl({
    bucket: file.bucket,
    contentType: file.contentType,
    key: file.objectKey,
  });
};

export const writeStoredFileObject = async (file: StoredFileRecord, bytes: Uint8Array) => {
  if (!isLocalMode()) throw new Error("直接上传仅支持本地模式");
  await writeLocalObject(file, bytes);
};

export const getStoredObjectSize = async (file: StoredFileRecord) => {
  if (isLocalMode()) return getLocalObjectSize(file);
  const object = await headR2Object(file.bucket, file.objectKey);
  return Number(object.ContentLength || 0);
};

export const getStoredFileBytes = async (file: StoredFileRecord) => {
  if (isLocalMode()) return getLocalObjectBytes(file);
  return getR2ObjectBytes(file.bucket, file.objectKey);
};

export const getStoredFileDownloadUrl = (file: StoredFileRecord) => {
  if (!isCloudMode()) return undefined;
  return createDownloadUrl(file.bucket, file.objectKey, file.originalName);
};

export const getStoredFilePreviewUrl = (file: StoredFileRecord) => {
  if (!isCloudMode()) return undefined;
  return createPreviewUrl(file.bucket, file.objectKey, file.contentType, file.originalName);
};

export const getStoredAvatarUrl = (file: StoredFileRecord) => {
  if (isLocalMode()) return `/api/files/${file.id}/preview`;
  return getPublicObjectUrl(file.objectKey);
};
