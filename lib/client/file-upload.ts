export type UploadKind = "attachment" | "avatar";

export type UploadedFile = {
  contentType: string;
  id: string;
  kind: UploadKind;
  name: string;
  size: number;
  url?: string;
};

type UploadOptions = {
  contentType?: string;
  kind: UploadKind;
  signal?: AbortSignal;
};

type PresignResponse = {
  file: UploadedFile;
  uploadUrl: string;
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  md: "text/markdown",
  pdf: "application/pdf",
  png: "image/png",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text);
  }
};

const responseError = (data: unknown, fallback: string) => {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
};

export const resolveFileContentType = (file: File) => {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return CONTENT_TYPE_BY_EXTENSION[extension] || "application/octet-stream";
};

export async function uploadFile(
  file: File,
  { contentType = resolveFileContentType(file), kind, signal }: UploadOptions,
): Promise<UploadedFile> {
  let uploadId: string | undefined;
  let completed = false;

  try {
    const presign = await fetch("/api/files/presign", {
      body: JSON.stringify({ contentType, kind, name: file.name, size: file.size }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal,
    });
    const task = await readJson<PresignResponse & { error?: string }>(presign);
    if (!presign.ok) {
      throw new Error(responseError(task, "无法创建上传任务"));
    }

    uploadId = task.file.id;
    const storageUpload = await fetch(task.uploadUrl, {
      body: file,
      headers: { "Content-Type": contentType },
      method: "PUT",
      signal,
    });
    if (!storageUpload.ok) throw new Error(kind === "avatar" ? "头像上传失败" : "文件上传失败");

    const complete = await fetch("/api/files/complete", {
      body: JSON.stringify({ id: uploadId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal,
    });
    const result = await readJson<{ error?: string; file: UploadedFile }>(complete);
    if (!complete.ok) {
      throw new Error(responseError(result, kind === "avatar" ? "头像校验失败" : "文件校验失败"));
    }

    completed = true;
    return result.file;
  } catch (error) {
    if (uploadId && !completed) {
      await fetch(`/api/files/${uploadId}`, { method: "DELETE" }).catch(() => undefined);
    }
    throw error;
  }
}
