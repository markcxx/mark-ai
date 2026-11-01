import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { readMembership } from "@/lib/server/plans";
import { createCheckout, PAYMENT_METHODS, type PaymentMethod } from "@/lib/server/payments";

export const dynamic = "force-dynamic";

const TIERS = ["starter", "plus", "pro"] as const;

// The client chooses only tier and method; amount, product and recipient are
// decided on the server.
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request);
  if (!auth.authorized) return auth.response;
  if (!auth.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin)
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  const limited = enforceRateLimit({ key: auth.key, limit: 10, scope: "payment-create" });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const tier = body?.tier;
  const method = body?.method;
  if (!TIERS.includes(tier) || !PAYMENT_METHODS.includes(method))
    return NextResponse.json({ error: "请选择有效的套餐和支付方式" }, { status: 400 });

  const membership = await readMembership(auth.userId);
  if (membership.tier === "lifetime")
    return NextResponse.json({ error: "你已是永久会员，无需购买" }, { status: 409 });
  if (TIERS.indexOf(tier) < TIERS.indexOf(membership.tier as (typeof TIERS)[number]))
    return NextResponse.json({ error: "当前套餐更高，到期后再开通较低的套餐" }, { status: 409 });

  try {
    const checkout = await createCheckout({
      userId: auth.userId,
      tier,
      method: method as PaymentMethod,
      clientIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      origin: request.nextUrl.origin,
    });
    return NextResponse.json(checkout, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PaymentNotConfigured" || message === "InvalidPaymentGateway")
      return NextResponse.json({ error: "在线支付暂未开通，请联系管理员开通" }, { status: 503 });
    if (message === "InvalidPaymentMethod")
      return NextResponse.json({ error: "当前不支持该支付方式" }, { status: 400 });
    if (message === "InvalidPlan")
      return NextResponse.json({ error: "套餐配置无效，请刷新后重试" }, { status: 400 });
    return NextResponse.json(
      { error: /[一-龥]/.test(message) ? message : "创建订单失败，请稍后重试" },
      { status: 502 },
    );
  }
}
