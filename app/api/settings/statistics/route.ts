import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { getMonthlyUsage, getStatisticsOverview } from "@/lib/settings/statistics-server";
import { utcMonth } from "@/lib/settings/statistics";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await authorizeApiRequest(request);
  if (!auth.authorized) return auth.response;
  const limited = enforceRateLimit({ key: auth.key, limit: 60, scope: "settings-statistics" });
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  try {
    let result;
    if (params.get("view") === "monthly") {
      const month = params.get("month") || utcMonth();
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
        return NextResponse.json({ error: "请选择有效月份" }, { status: 400 });
      const page = Number(params.get("page") || 1),
        pageSize = Number(params.get("pageSize") || 5);
      if (!Number.isSafeInteger(page) || page < 1 || ![5, 10, 20, 50].includes(pageSize))
        return NextResponse.json({ error: "分页参数无效" }, { status: 400 });
      result = await getMonthlyUsage(
        auth.userId,
        month,
        page,
        pageSize,
        params.get("sort") === "tokens" ? "tokens" : "time",
        params.get("direction") === "asc" ? "asc" : "desc",
      );
    } else result = await getStatisticsOverview(auth.userId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("Statistics query failed:", e);
    return NextResponse.json({ error: "统计数据加载失败，请重试" }, { status: 500 });
  }
}
