import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

const getEncryptionKey = () => {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim() || process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY or AUTH_SECRET is required to store API keys");
  }

  return createHash("sha256").update(secret).digest();
};

export const encryptCredential = (value: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv, tag, encrypted]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(":");
};

export const decryptCredential = (value: string) => {
  const [version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported encrypted credential format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};
