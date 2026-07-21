import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { readWebpage } from "@/lib/search/webpage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeApiRequest(req);
    if (!authorization.authorized) return authorization.response;
    const limited = enforceRateLimit({ key: authorization.key, limit: 20, scope: "read-webpage" });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url || url.length > 2_048) {
      return NextResponse.json({ error: "请输入有效的网页地址" }, { status: 400 });
    }

    const data = await readWebpage({ signal: req.signal, url });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "网页读取已取消" }, { status: 499 });
    }

    const message = error instanceof Error ? error.message : "网页读取失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
