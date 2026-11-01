import { matchesPayment, parseZpayParams, validZpaySignature } from "@/lib/payments/zpay";
import { confirmPayment, findOrderByProviderNumber, paymentConfig } from "@/lib/server/payments";

export const dynamic = "force-dynamic";

// Public machine-to-machine endpoint called by ZPay. It verifies the signature,
// then re-queries the provider before marking anything paid. It never returns
// user data. ZPay expects the literal body "success".
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };
  try {
    const config = paymentConfig();
    const params = parseZpayParams(new URL(request.url).search);
    if (
      !validZpaySignature(params, config.key) ||
      params.pid !== config.pid ||
      params.trade_status !== "TRADE_SUCCESS" ||
      !/^\d{1,32}$/.test(params.out_trade_no || "")
    )
      return new Response("fail", { status: 400, headers });
    const order = await findOrderByProviderNumber(params.out_trade_no);
    if (!order || !matchesPayment(order, params, config.pid, true))
      return new Response("fail", { status: 400, headers });
    if (!(await confirmPayment(order, params.trade_no)))
      return new Response("fail", { status: 409, headers });
    return new Response("success", { headers });
  } catch {
    return new Response("fail", { status: 503, headers });
  }
}
