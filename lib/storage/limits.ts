export const storageLimits = {
  maxAvatarBytes: Number(
    process.env.MARKAI_MAX_AVATAR_BYTES || process.env.R2_USER_MAX_AVATAR_BYTES || 2 * 1024 * 1024,
  ),
  maxFileBytes: Number(
    process.env.MARKAI_MAX_FILE_BYTES || process.env.R2_USER_MAX_FILE_BYTES || 20 * 1024 * 1024,
  ),
  maxFileCount: Number(
    process.env.MARKAI_MAX_FILE_COUNT || process.env.R2_USER_MAX_FILE_COUNT || 50,
  ),
  maxStorageBytes: Number(
    process.env.MARKAI_MAX_STORAGE_BYTES ||
      process.env.R2_USER_MAX_STORAGE_BYTES ||
      200 * 1024 * 1024,
  ),
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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const isAllowedUploadType = (contentType: string, kind: "attachment" | "avatar") =>
  (kind === "avatar" ? ALLOWED_AVATAR_TYPES : ALLOWED_ATTACHMENT_TYPES).has(contentType);
