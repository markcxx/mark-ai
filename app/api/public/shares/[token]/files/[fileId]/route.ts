import { NextResponse } from "next/server";
import { getConversationShare } from "@/lib/chat/share-storage";
import { collectMessageFileIds } from "@/lib/chat/message-file-references";
import { getStoredFile, getStoredFileBytes } from "@/lib/storage/file-storage";
import { createOfficePreviewResponse, getOfficePreviewKind } from "@/lib/storage/office-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await context.params;
  const share = await getConversationShare(token);
  const unavailable = () => NextResponse.json({ error: "分享已失效或文件不存在" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!share || !collectMessageFileIds(share.snapshot.messages).has(fileId)) return unavailable();
  const file = await getStoredFile(fileId, share.userId, true);
  if (!file || file.kind !== "attachment") return unavailable();
  const params = new URL(request.url).searchParams;
  const download = params.get("action") === "download";
  const bytes = await getStoredFileBytes(file);
  if (!download && params.get("raw") !== "1" && getOfficePreviewKind(file)) {
    const preview = await createOfficePreviewResponse(file, bytes);
    if (preview) {
      preview.headers.set("Cache-Control", "no-store");
      preview.headers.set("Referrer-Policy", "no-referrer");
      return preview;
    }
  }
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, { headers: {
    "Cache-Control": "no-store",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    "Content-Type": file.contentType,
    "Content-Length": String(bytes.byteLength),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // Uploaded HTML/SVG must never execute with the application's origin.
    "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src blob: data:",
  } });
}
