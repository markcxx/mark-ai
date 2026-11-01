import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { readCreditSummary } from "@/lib/server/plans";

export const dynamic = "force-dynamic";

// Credit balance for the signed-in user's current membership period.
export async function GET(request: NextRequest) {
  const auth = await authorizeApiRequest(request, { deferPlatformRecord: () => undefined });
  if (!auth.authorized) return auth.response;
  if (!auth.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const limited = enforceRateLimit({ key: auth.key, limit: 60, scope: "credits" });
  if (limited) return limited;
  try {
    return NextResponse.json(await readCreditSummary(auth.userId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "额度读取失败，请稍后重试" }, { status: 500 });
  }
}
