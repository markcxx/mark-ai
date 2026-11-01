import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { pollOrder } from "@/lib/server/payments";

export const dynamic = "force-dynamic";

// Polled by the checkout dialog; only the order owner can read it.
export async function GET(request: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const auth = await authorizeApiRequest(request, { deferPlatformRecord: () => undefined });
  if (!auth.authorized) return auth.response;
  if (!auth.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const limited = enforceRateLimit({ key: auth.key, limit: 60, scope: "payment-poll" });
  if (limited) return limited;
  const { number } = await ctx.params;
  if (!/^MK\d{8}-[A-F0-9]{12}$/.test(number))
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  const order = await pollOrder(auth.userId, number);
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  return NextResponse.json(order, { headers: { "Cache-Control": "no-store" } });
}
