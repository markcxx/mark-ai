import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import { isLocalMode } from "@/lib/env";
import { getStoredFile, writeStoredFileObject } from "@/lib/storage/file-storage";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ fileId: string }> }) {
  if (!isLocalMode()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "无权上传文件" }, { status: 401 });
  const { fileId } = await context.params;
  const file = await getStoredFile(fileId, userId);
  if (!file || file.status !== "pending") {
    return NextResponse.json({ error: "上传任务不存在或已完成" }, { status: 404 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength !== file.size) {
    return NextResponse.json({ error: "上传文件大小不匹配" }, { status: 400 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength !== file.size) {
    return NextResponse.json({ error: "上传文件大小不匹配" }, { status: 400 });
  }

  await writeStoredFileObject(file, bytes);
  return new Response(null, { status: 204 });
}
