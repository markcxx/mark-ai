import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

let client: S3Client | undefined;

export const getR2Client = () => {
  if (!client) {
    const accountId = required("R2_ACCOUNT_ID");
    client = new S3Client({
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
      endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
      region: process.env.R2_REGION || "auto",
    });
  }
  return client;
};

export const getR2Bucket = (kind: "attachment" | "avatar") =>
  required(kind === "avatar" ? "R2_PUBLIC_BUCKET" : "R2_PRIVATE_BUCKET");

export const createUploadUrl = async ({
  bucket,
  contentType,
  key,
}: {
  bucket: string;
  contentType: string;
  key: string;
}) =>
  getSignedUrl(
    getR2Client(),
    new PutObjectCommand({ Bucket: bucket, ContentType: contentType, Key: key }),
    { expiresIn: Number(process.env.R2_PRESIGNED_URL_EXPIRES || 600) },
  );

export const createDownloadUrl = async (bucket: string, key: string, filename: string) =>
  getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    { expiresIn: 300 },
  );

export const createPreviewUrl = async (
  bucket: string,
  key: string,
  contentType: string,
  filename: string,
) =>
  getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      ResponseContentType: contentType,
    }),
    { expiresIn: 300 },
  );

export const headR2Object = (bucket: string, key: string) =>
  getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

export const putR2Object = (bucket: string, key: string, contentType: string, bytes: Uint8Array) =>
  getR2Client().send(
    new PutObjectCommand({
      Body: bytes,
      Bucket: bucket,
      ContentLength: bytes.byteLength,
      ContentType: contentType,
      Key: key,
    }),
  );

export const getR2ObjectBytes = async (bucket: string, key: string) => {
  const response = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error("R2 object has no body");
  return response.Body.transformToByteArray();
};

export const deleteR2Object = (bucket: string, key: string) =>
  getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

export const getPublicObjectUrl = (key: string) =>
  `${required("R2_PUBLIC_BASE_URL").replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
