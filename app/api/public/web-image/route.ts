import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/security";
import { normalizeWebImageUrl } from "@/lib/chat/web-image-url";
import { fetchWebImage } from "@/lib/search/web-image";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = normalizeWebImageUrl(req.nextUrl.searchParams.get("url"));
  if (!url) return NextResponse.json({ error: "图片地址不受支持" }, { status: 400 });
  const key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = enforceRateLimit({ key, scope: "web-image", limit: 120 });
  if (limited) return limited;
  try {
    const image = await fetchWebImage(url, req.signal, req.nextUrl.searchParams.get("source") || undefined);
    return new Response(new Uint8Array(image.bytes), { headers: {
      "Content-Type": image.type,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch {
    return NextResponse.json({ error: "来源图片暂时无法加载，请稍后重试" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
