import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { getSettingsUsage } from "@/lib/settings/usage-server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const authorization = await authorizeApiRequest(request);
  if (!authorization.authorized) return authorization.response;
  const limited = enforceRateLimit({ key: authorization.key, limit: 30, scope: "settings-usage" });
  if (limited) return limited;
  const requested = Number(request.nextUrl.searchParams.get("days"));
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  try {
    return NextResponse.json(await getSettingsUsage(authorization.userId, days), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Settings usage error:", error);
    return NextResponse.json({ error: "使用统计加载失败，请稍后重试" }, { status: 500 });
  }
}
