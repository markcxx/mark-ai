import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { getDb } from "@/lib/db";
import { storageFiles } from "@/lib/db/schema";
import {
  deleteStoredFile,
  getStoredFileBytes,
  getStoredFileDownloadUrl,
  getStoredFilePreviewUrl,
  toStoredFileRecord,
} from "@/lib/storage/file-storage";
import { createOfficePreviewResponse, getOfficePreviewKind } from "@/lib/storage/office-preview";

const findFile = async (fileId: string, userId: string) => {
  const [file] = await getDb()
    .select()
    .from(storageFiles)
    .where(and(eq(storageFiles.id, fileId), eq(storageFiles.userId, userId)))
    .limit(1);
  return file;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string; userId: string }> },
) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { fileId, userId } = await context.params;
  const storedFile = await findFile(fileId, userId);
  if (!storedFile) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  const file = toStoredFileRecord(storedFile);
  const action = new URL(request.url).searchParams.get("action");

  if (action === "download-content") {
    const downloadUrl = await getStoredFileDownloadUrl(file);
    if (!downloadUrl) {
      return NextResponse.json({ error: "当前存储模式不支持下载" }, { status: 400 });
    }
    return NextResponse.redirect(downloadUrl);
  }

  if (action === "content") {
    if (getOfficePreviewKind(file)) {
      const bytes = await getStoredFileBytes(file);
      const preview = await createOfficePreviewResponse(file, bytes);
      if (preview) return preview;
    }
    const previewUrl = await getStoredFilePreviewUrl(file);
    if (!previewUrl) {
      return NextResponse.json({ error: "当前存储模式不支持管理员预览" }, { status: 400 });
    }
    const range = request.headers.get("range");
    const upstream = await fetch(previewUrl, {
      headers: range ? { Range: range } : undefined,
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "文件内容读取失败" }, { status: upstream.status });
    }
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Content-Type": file.contentType,
      "X-Content-Type-Options": "nosniff",
    });
    if (file.contentType === "text/html" || file.contentType === "image/svg+xml") {
      headers.set(
        "Content-Security-Policy",
        "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      );
    }
    for (const name of ["accept-ranges", "content-length", "content-range"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { headers, status: upstream.status });
  }

  const url =
    action === "download"
      ? await getStoredFileDownloadUrl(file)
      : `${new URL(request.url).pathname}?action=content`;
  await writeAdminAudit({
    action: action === "download" ? "file.download" : "file.preview",
    actorUserId: admin.id,
    request,
    targetId: fileId,
    targetType: "file",
  });
  return NextResponse.json({ file, url });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ fileId: string; userId: string }> },
) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { fileId, userId } = await context.params;
  const storedFile = await findFile(fileId, userId);
  if (!storedFile) return NextResponse.json({ ok: true });
  const file = toStoredFileRecord(storedFile);
  await deleteStoredFile(file);
  await writeAdminAudit({
    action: "file.delete",
    actorUserId: admin.id,
    metadata: { name: file.originalName, size: file.size, userId },
    request,
    targetId: fileId,
    targetType: "file",
  });
  return NextResponse.json({ ok: true });
}
