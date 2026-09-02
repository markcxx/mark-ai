const BYTES_PER_MB = 1024 * 1024;
type StorageLimitEnvironment = Record<string, string | undefined>;

const parsePositiveLimit = (name: string, value: string | undefined) => {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是大于 0 的数字`);
  }
  return parsed;
};

const resolveByteLimit = ({
  byteNames,
  defaultMb,
  env,
  mbNames,
}: {
  byteNames: string[];
  defaultMb: number;
  env: StorageLimitEnvironment;
  mbNames: string[];
}) => {
  for (const name of mbNames) {
    const value = parsePositiveLimit(name, env[name]);
    if (value !== undefined) return Math.floor(value * BYTES_PER_MB);
  }
  for (const name of byteNames) {
    const value = parsePositiveLimit(name, env[name]);
    if (value !== undefined) return Math.floor(value);
  }
  return defaultMb * BYTES_PER_MB;
};

export const resolveStorageLimits = (env: StorageLimitEnvironment = process.env) => ({
  maxAvatarBytes: resolveByteLimit({
    byteNames: ["MARKAI_MAX_AVATAR_BYTES", "R2_USER_MAX_AVATAR_BYTES"],
    defaultMb: 5,
    env,
    mbNames: ["MARKAI_MAX_AVATAR_MB", "R2_USER_MAX_AVATAR_MB"],
  }),
  maxFileBytes: resolveByteLimit({
    byteNames: ["MARKAI_MAX_FILE_BYTES", "R2_USER_MAX_FILE_BYTES"],
    defaultMb: 30,
    env,
    mbNames: ["MARKAI_MAX_FILE_MB", "R2_USER_MAX_FILE_MB"],
  }),
  maxStorageBytes: resolveByteLimit({
    byteNames: ["MARKAI_MAX_STORAGE_BYTES", "R2_USER_MAX_STORAGE_BYTES"],
    defaultMb: 500,
    env,
    mbNames: ["MARKAI_MAX_STORAGE_MB", "R2_USER_MAX_STORAGE_MB"],
  }),
});

export const storageLimits = resolveStorageLimits();

export const formatStorageLimitMb = (bytes: number) => {
  const value = bytes / BYTES_PER_MB;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
};

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const isAllowedUploadType = (contentType: string, kind: "attachment" | "avatar") =>
  (kind === "avatar" ? ALLOWED_AVATAR_TYPES : ALLOWED_ATTACHMENT_TYPES).has(contentType);
