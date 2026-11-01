import "server-only";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import QRCode from "qrcode";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getAppUrl } from "@/lib/app-url";
import { getDb } from "@/lib/db";
import { paymentOrders, userMemberships } from "@/lib/db/schema";
import type { PlanId } from "@/lib/plans";
import { matchesPayment, zpaySign } from "@/lib/payments/zpay";
import { readPlans } from "./plans";

export const PAYMENT_METHODS = ["alipay", "wxpay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
type PaidTier = Exclude<PlanId, "free" | "lifetime">;

const GATEWAYS = ["https://zpayz.cn", "https://z-pay.cn", "https://api.z-pay.cn"];
const ORDER_TTL_MS = 30 * 60_000;
const MONTH_MS = 30 * 86_400_000;

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Public https origin that receives ZPay's async notify. Production needs only
 * APP_URL; local development (APP_URL on localhost) may set PAYMENT_NOTIFY_URL
 * to the deployed site. MARKAI_SITE_URL is read for older configurations.
 */
export function publicSiteOrigin() {
  const candidates = [process.env.PAYMENT_NOTIFY_URL, process.env.MARKAI_SITE_URL, getAppUrl()];
  for (const value of candidates) {
    try {
      const url = new URL(value || "");
      if (url.protocol === "https:" && !LOOPBACK.includes(url.hostname)) return url.origin;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/**
 * Server-only ZPay configuration, as in PinePPT. Payments are confirmed by
 * polling ZPay's order query as well as by the notify callback.
 */
export function paymentConfig() {
  const pid = process.env.ZPAY_PID || "";
  const key = process.env.ZPAY_KEY || "";
  const siteOrigin = publicSiteOrigin();
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(pid) || !/^[a-zA-Z0-9_-]{16,128}$/.test(key) || !siteOrigin)
    throw Error("PaymentNotConfigured");
  const base = process.env.ZPAY_API_BASE || GATEWAYS[0];
  if (!GATEWAYS.includes(base)) throw Error("InvalidPaymentGateway");
  const methods = (process.env.ZPAY_METHODS || "alipay,wxpay")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is PaymentMethod => PAYMENT_METHODS.includes(value as PaymentMethod));
  if (!methods.length) throw Error("PaymentNotConfigured");
  return { pid, key, site: siteOrigin, base, methods };
}

/**
 * Browser returns may go back to loopback for local testing; webhooks always use
 * the configured public site. Arbitrary hosts are never accepted.
 */
export function paymentReturnOrigin(candidate: string | null | undefined, publicOrigin: string) {
  try {
    const url = new URL(candidate || "");
    if (url.username || url.password) return publicOrigin;
    if (url.origin === publicOrigin) return publicOrigin;
    if (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      return url.origin;
  } catch {
    // Invalid or absent origins fall back to the fixed public site.
  }
  return publicOrigin;
}

export function paymentAvailability() {
  try {
    return { enabled: true, methods: paymentConfig().methods };
  } catch {
    return { enabled: false, methods: [] as PaymentMethod[] };
  }
}

const safeUrl = (value: unknown, schemes = ["https:"]) => {
  if (typeof value !== "string" || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    return schemes.includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
};

export type CheckoutResult = {
  orderNumber: string;
  amountCents: number;
  method: PaymentMethod;
  expiresAt: string;
  /** QR image: a data URL rendered here, or the provider's image URL. */
  qrImage?: string;
  /** Same-device payment page (mobile H5). */
  payUrl?: string;
};

/**
 * Creates an order for one month of a paid tier. Amount and tier come from the
 * server's plan config; the client only chooses the tier and method.
 */
export async function createCheckout({
  userId,
  tier,
  method,
  clientIp,
  origin,
}: {
  userId: string;
  tier: PaidTier;
  method: PaymentMethod;
  clientIp?: string;
  /** Origin the checkout started from; decides where the browser returns. */
  origin?: string | null;
}): Promise<CheckoutResult> {
  const config = paymentConfig();
  if (!config.methods.includes(method)) throw Error("InvalidPaymentMethod");
  const { config: plans } = await readPlans();
  const plan = plans.tiers.find((item) => item.id === tier);
  if (!plan) throw Error("InvalidPlan");
  const amountCents = Math.round(plan.price * 100);
  if (!(amountCents > 0)) throw Error("InvalidPlan");

  const orderNumber = `MK${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`;
  const providerOrderNumber = `${Date.now()}${randomInt(1_000_000_000).toString().padStart(9, "0")}`;
  const expiresAt = new Date(Date.now() + ORDER_TTL_MS);
  const params: Record<string, string> = {
    pid: config.pid,
    type: method,
    out_trade_no: providerOrderNumber,
    notify_url: `${config.site}/api/payments/zpay/notify`,
    return_url: `${paymentReturnOrigin(origin, config.site)}/api/payments/zpay/return`,
    name: `MarkAI ${plan.name} 1 个月`.slice(0, 90),
    money: (amountCents / 100).toFixed(2),
    clientip: clientIp && isIP(clientIp) ? clientIp : "127.0.0.1",
    device: "pc",
  };
  params.sign = zpaySign(params, config.key);
  params.sign_type = "MD5";

  await getDb().insert(paymentOrders).values({
    id: randomUUID(),
    orderNumber,
    userId,
    tier,
    months: 1,
    amountCents,
    provider: "zpay",
    providerOrderNumber,
    paymentMethod: method,
    merchantId: config.pid,
    expiresAt,
  });

  let result: Record<string, unknown>;
  try {
    const form = new FormData();
    for (const [key, value] of Object.entries(params)) form.set(key, value);
    const response = await fetch(`${config.base}/mapi.php`, {
      method: "POST",
      body: form,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw Error();
    const body = await response.text();
    if (body.length > 32_768) throw Error();
    result = JSON.parse(body);
    if (Number(result.code) !== 1) throw Error();
  } catch {
    throw Error("暂时无法创建支付订单，请稍后重试");
  }
  const qrPayload = safeUrl(result.qrcode, ["https:", "alipays:", "weixin:"]);
  const qrImage = qrPayload
    ? await QRCode.toDataURL(qrPayload, { width: 480, margin: 3, errorCorrectionLevel: "M" })
    : safeUrl(result.img);
  const payUrl = safeUrl(result.payurl);
  if (!qrImage && !payUrl) throw Error("当前支付通道未返回付款入口，请稍后重试");
  return {
    orderNumber,
    amountCents,
    method,
    expiresAt: expiresAt.toISOString(),
    qrImage,
    payUrl,
  };
}

// Never log this URL: ZPay's query API carries the merchant key.
async function queryPayment(providerOrderNumber: string): Promise<Record<string, unknown>> {
  const config = paymentConfig();
  const url = new URL(`${config.base}/api.php`);
  url.search = new URLSearchParams({
    act: "order",
    pid: config.pid,
    key: config.key,
    out_trade_no: providerOrderNumber,
  }).toString();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw Error();
    const body = await response.text();
    if (body.length > 16_384) throw Error();
    return JSON.parse(body);
  } catch {
    throw Error("PaymentVerificationUnavailable");
  }
}

type OrderRow = typeof paymentOrders.$inferSelect;

/**
 * Re-queries the provider and, if the payment matches the order exactly, marks
 * it paid and extends the membership. Notify params are never trusted alone.
 * The conditional UPDATE is the idempotency guard across notify and polling.
 */
export async function confirmPayment(order: OrderRow, expectedTrade?: string) {
  if (order.provider !== "zpay") return false;
  if (order.status === "paid") return true;
  const config = paymentConfig();
  const result = await queryPayment(order.providerOrderNumber);
  if (
    !matchesPayment(order, result, config.pid) ||
    (expectedTrade && result.trade_no !== expectedTrade)
  )
    return false;
  const tradeNo = String(result.trade_no);
  const db = getDb();
  const [claimed] = await db
    .update(paymentOrders)
    .set({ status: "paid", paidAt: new Date(), providerTransactionId: tradeNo })
    .where(
      and(
        eq(paymentOrders.id, order.id),
        inArray(paymentOrders.status, ["pending", "expired"]),
        isNull(paymentOrders.providerTransactionId),
      ),
    )
    .returning();
  if (!claimed) {
    const [current] = await db
      .select({ status: paymentOrders.status, trade: paymentOrders.providerTransactionId })
      .from(paymentOrders)
      .where(eq(paymentOrders.id, order.id));
    return current?.status === "paid" && current.trade === tradeNo;
  }
  await grantMembership(claimed);
  return true;
}

/**
 * Extends from the later of now and the current expiry for the same tier; an
 * upgrade starts fresh from now. Lifetime members are never downgraded.
 */
async function grantMembership(order: OrderRow) {
  const db = getDb();
  const [current] = await db
    .select()
    .from(userMemberships)
    .where(eq(userMemberships.userId, order.userId));
  if (current?.tier === "lifetime") return;
  const now = Date.now();
  const active = current?.expiresAt && current.expiresAt.getTime() > now;
  const start = active && current.tier === order.tier ? current.expiresAt!.getTime() : now;
  const expiresAt = new Date(start + order.months * MONTH_MS);
  const values = { userId: order.userId, tier: order.tier, expiresAt, updatedAt: new Date() };
  await db
    .insert(userMemberships)
    .values(values)
    .onConflictDoUpdate({ target: userMemberships.userId, set: values });
  await db
    .update(paymentOrders)
    .set({ membershipExpiresAt: expiresAt })
    .where(eq(paymentOrders.id, order.id));
}

export async function findOrderByProviderNumber(providerOrderNumber: string) {
  const [order] = await getDb()
    .select()
    .from(paymentOrders)
    .where(
      and(
        eq(paymentOrders.provider, "zpay"),
        eq(paymentOrders.providerOrderNumber, providerOrderNumber),
      ),
    );
  return order;
}

/**
 * Status for the order owner's polling. Provider queries are throttled to one
 * per 10 seconds per order via an atomic claim on last_checked_at.
 */
export async function pollOrder(userId: string, orderNumber: string) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.orderNumber, orderNumber), eq(paymentOrders.userId, userId)));
  if (!order) return null;
  let status = order.status;
  if (status === "pending" || status === "expired") {
    const [claimed] = await db
      .update(paymentOrders)
      .set({ lastCheckedAt: new Date() })
      .where(
        and(
          eq(paymentOrders.id, order.id),
          or(
            isNull(paymentOrders.lastCheckedAt),
            lt(paymentOrders.lastCheckedAt, sql`now() - interval '10 seconds'`),
          ),
        ),
      )
      .returning({ id: paymentOrders.id });
    if (claimed) {
      try {
        if (await confirmPayment(order)) status = "paid";
      } catch {
        // Provider unavailable: report the stored status and let the client retry.
      }
    }
    if (status === "pending" && order.expiresAt.getTime() <= Date.now()) {
      await db
        .update(paymentOrders)
        .set({ status: "expired" })
        .where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, "pending")));
      status = "expired";
    }
  }
  const [fresh] = await db
    .select({ membershipExpiresAt: paymentOrders.membershipExpiresAt })
    .from(paymentOrders)
    .where(eq(paymentOrders.id, order.id));
  return {
    status,
    tier: order.tier,
    amountCents: order.amountCents,
    membershipExpiresAt: fresh?.membershipExpiresAt?.toISOString() ?? null,
  };
}
