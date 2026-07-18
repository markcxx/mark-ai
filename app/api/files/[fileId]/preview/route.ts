import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import {
  getStoredFile,
  getStoredFileBytes,
  getStoredFilePreviewUrl,
} from "@/lib/storage/file-storage";
import { createOfficePreviewResponse, getOfficePreviewKind } from "@/lib/storage/office-preview";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { fileId } = await context.params;
  const file = await getStoredFile(fileId, userId, true);
  if (!file) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  if (getOfficePreviewKind(file)) {
    const bytes = await getStoredFileBytes(file);
    const preview = await createOfficePreviewResponse(file, bytes);
    if (preview) return preview;
  }

  const remoteUrl = await getStoredFilePreviewUrl(file);
  if (remoteUrl) return NextResponse.redirect(remoteUrl);

  const bytes = await getStoredFileBytes(file);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    headers: {
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Content-Length": String(file.size),
      "Content-Type": file.contentType,
    },
  });
}
