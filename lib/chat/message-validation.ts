import type { Message } from "./types";

export const MAX_MESSAGE_CONTENT_CHARS = 200_000;

const hasValidAttachments = (message: Partial<Message>) =>
  !message.attachments ||
  (Array.isArray(message.attachments) &&
    message.attachments.length <= 4 &&
    message.attachments.every(
      (file) =>
        file &&
        typeof file.id === "string" &&
        typeof file.name === "string" &&
        typeof file.size === "number" &&
        typeof file.contentType === "string",
    ));

export const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<Message>;
  return (
    typeof message.id === "string" &&
    message.id.length > 0 &&
    message.id.length <= 256 &&
    typeof message.content === "string" &&
    message.content.length <= MAX_MESSAGE_CONTENT_CHARS &&
    (message.role === "user" || message.role === "model") &&
    hasValidAttachments(message)
  );
};

export const parseExpectedRevision = (value: unknown) => {
  const normalized =
    typeof value === "string" ? value.trim().replace(/^W\//, "").replace(/^"|"$/g, "") : value;
  const revision = typeof normalized === "string" && normalized ? Number(normalized) : normalized;
  return Number.isSafeInteger(revision) && Number(revision) >= 0 ? Number(revision) : undefined;
};

export const hasInvalidExpectedRevision = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  parseExpectedRevision(value) === undefined;
