import mammoth from "mammoth";
import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import {
  getStoredFile,
  getStoredFileBytes,
  getStoredFilePreviewUrl,
} from "@/lib/storage/file-storage";
import { renderSpreadsheetPreview } from "@/lib/storage/spreadsheet";

export const runtime = "nodejs";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const createDocxPreview = async (bytes: Uint8Array, name: string) => {
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  const title = escapeHtml(name);
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #eef0f3; color: #24262b; font-family: ui-serif, "Songti SC", "SimSun", serif; line-height: 1.75; }
      main { width: min(860px, calc(100% - 32px)); min-height: calc(100vh - 32px); margin: 16px auto; padding: 64px 72px; background: white; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); }
      h1, h2, h3, h4, h5, h6 { color: #17191d; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.35; }
      h1 { margin: 0 0 28px; font-size: 2rem; }
      h2 { margin: 32px 0 14px; font-size: 1.5rem; }
      h3 { margin: 26px 0 12px; font-size: 1.2rem; }
      p { margin: 0 0 14px; }
      ul, ol { margin: 0 0 16px; padding-left: 1.6em; }
      table { width: 100%; margin: 20px 0; border-collapse: collapse; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; }
      th, td { border: 1px solid #d9dde3; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #f5f6f8; font-weight: 600; }
      img { max-width: 100%; height: auto; }
      a { color: #2563eb; }
      @media (max-width: 680px) { main { width: 100%; min-height: 100vh; margin: 0; padding: 32px 22px; box-shadow: none; } }
    </style>
  </head>
  <body><main>${result.value}</main></body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}.html`,
      "Content-Security-Policy":
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'; object-src 'none'; sandbox",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { fileId } = await context.params;
  const file = await getStoredFile(fileId, userId, true);
  if (!file) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  const isDocx =
    file.contentType === DOCX_CONTENT_TYPE || file.originalName.toLowerCase().endsWith(".docx");
  if (isDocx) {
    const bytes = await getStoredFileBytes(file);
    return createDocxPreview(bytes, file.originalName);
  }

  const isXlsx =
    file.contentType === XLSX_CONTENT_TYPE || file.originalName.toLowerCase().endsWith(".xlsx");
  if (isXlsx) {
    const bytes = await getStoredFileBytes(file);
    const html = renderSpreadsheetPreview(bytes, file.originalName);
    return new Response(html, {
      headers: {
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}.html`,
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'; sandbox",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
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
