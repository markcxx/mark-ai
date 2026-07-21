import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";

export type StoredFileRecord = {
  bucket: string;
  contentType: string;
  createdAt: Date;
  id: string;
  kind: "attachment" | "avatar";
  objectKey: string;
  originalName: string;
  size: number;
  status: "pending" | "ready";
  updatedAt: Date;
  userId: string;
};

type DatabaseLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...values: unknown[]) => unknown[];
    get: (...values: unknown[]) => unknown;
    run: (...values: unknown[]) => unknown;
  };
};

type LocalFileRow = {
  bucket: string;
  content_type: string;
  created_at: number;
  id: string;
  kind: string;
  object_key: string;
  original_name: string;
  size: number;
  status: string;
  updated_at: number;
  user_id: string;
};

const require = createRequire(import.meta.url);
const LOCAL_BUCKET = "local";
let database: DatabaseLike | undefined;

const getDatabasePath = () =>
  process.env.MARKAI_SQLITE_PATH?.trim() || path.join(process.cwd(), ".data", "markai.sqlite");

const getFilesRoot = () =>
  path.resolve(
    process.env.MARKAI_LOCAL_FILES_DIR?.trim() ||
      path.join(path.dirname(getDatabasePath()), "files"),
  );

const getDatabase = () => {
  if (database) return database;

  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filename: string) => DatabaseLike;
  };
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS storage_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      bucket TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'attachment',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_storage_files_user_status
      ON storage_files(user_id, status);
  `);
  return database;
};

const toStoredFile = (row: LocalFileRow): StoredFileRecord => ({
  bucket: row.bucket,
  contentType: row.content_type,
  createdAt: new Date(row.created_at),
  id: row.id,
  kind: row.kind === "avatar" ? "avatar" : "attachment",
  objectKey: row.object_key,
  originalName: row.original_name,
  size: Number(row.size),
  status: row.status === "ready" ? "ready" : "pending",
  updatedAt: new Date(row.updated_at),
  userId: row.user_id,
});

const getObjectPath = (objectKey: string) => {
  const root = getFilesRoot();
  const objectPath = path.resolve(root, objectKey);
  if (objectPath !== root && !objectPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("本地文件路径无效");
  }
  return objectPath;
};

export const createLocalFileRecord = (file: Omit<StoredFileRecord, "createdAt" | "updatedAt">) => {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO storage_files
        (id, user_id, bucket, object_key, original_name, content_type, size, kind, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      file.id,
      file.userId,
      LOCAL_BUCKET,
      file.objectKey,
      file.originalName,
      file.contentType,
      file.size,
      file.kind,
      file.status,
      now,
      now,
    );
};

export const getLocalFileRecord = (id: string, userId = LOCAL_STORAGE_OWNER_ID) => {
  const row = getDatabase()
    .prepare("SELECT * FROM storage_files WHERE id = ? AND user_id = ?")
    .get(id, userId) as LocalFileRow | undefined;
  return row ? toStoredFile(row) : undefined;
};

export const listLocalAttachmentFiles = (userId = LOCAL_STORAGE_OWNER_ID) =>
  (
    getDatabase()
      .prepare(
        `SELECT * FROM storage_files
       WHERE user_id = ? AND kind = 'attachment' AND status = 'ready'
       ORDER BY created_at DESC`,
      )
      .all(userId) as LocalFileRow[]
  ).map(toStoredFile);

export const getLocalFileUsage = (userId = LOCAL_STORAGE_OWNER_ID) => {
  const row = getDatabase()
    .prepare(
      `SELECT COUNT(id) AS file_count, COALESCE(SUM(size), 0) AS total_size
       FROM storage_files
       WHERE user_id = ? AND kind = 'attachment' AND status = 'ready'`,
    )
    .get(userId) as { file_count?: number; total_size?: number } | undefined;
  return { count: Number(row?.file_count || 0), size: Number(row?.total_size || 0) };
};

export const markLocalFileReady = (id: string, userId = LOCAL_STORAGE_OWNER_ID) => {
  getDatabase()
    .prepare(
      "UPDATE storage_files SET status = 'ready', updated_at = ? WHERE id = ? AND user_id = ?",
    )
    .run(Date.now(), id, userId);
};

export const deleteLocalFileRecord = (id: string, userId = LOCAL_STORAGE_OWNER_ID) => {
  getDatabase().prepare("DELETE FROM storage_files WHERE id = ? AND user_id = ?").run(id, userId);
};

export const writeLocalObject = async (file: StoredFileRecord, bytes: Uint8Array) => {
  if (bytes.byteLength !== file.size) throw new Error("上传文件大小与预期不一致");
  const objectPath = getObjectPath(file.objectKey);
  const temporaryPath = `${objectPath}.uploading`;
  await fsPromises.mkdir(path.dirname(objectPath), { recursive: true });
  try {
    await fsPromises.writeFile(temporaryPath, bytes);
    await fsPromises.rename(temporaryPath, objectPath);
  } catch (error) {
    await fsPromises.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
};

export const getLocalObjectSize = async (file: StoredFileRecord) =>
  (await fsPromises.stat(getObjectPath(file.objectKey))).size;

export const getLocalObjectBytes = async (file: StoredFileRecord) =>
  new Uint8Array(await fsPromises.readFile(getObjectPath(file.objectKey)));

export const deleteLocalObject = async (file: StoredFileRecord) => {
  await fsPromises.rm(getObjectPath(file.objectKey), { force: true });
};
