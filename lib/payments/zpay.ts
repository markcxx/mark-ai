import { createHash, timingSafeEqual } from "node:crypto";

// ZPay (码支付) aggregator protocol, ported from PinePPT. Alipay is `type=alipay`.
// Signatures are MD5 over decoded values sorted by key, empty fields excluded.

export type ZpayParams = Record<string, string>;

export function zpaySign(params: Record<string, string | undefined | null>, key: string) {
  const plain = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("md5")
    .update(plain + key, "utf8")
    .digest("hex");
}

export function validZpaySignature(params: ZpayParams, key: string) {
  if (params.sign_type !== "MD5" || !/^[a-f0-9]{32}$/.test(params.sign || "")) return false;
  return timingSafeEqual(
    Buffer.from(zpaySign(params, key), "hex"),
    Buffer.from(params.sign, "hex"),
  );
}

/** "39.00" -> 3900; rejects anything that is not a plain 2-decimal amount. */
export function moneyCents(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function parseZpayParams(search: string): ZpayParams {
  if (search.length > 8192) throw Error("Invalid notification");
  const params: ZpayParams = Object.create(null);
  for (const [key, value] of new URLSearchParams(search)) {
    if (Object.hasOwn(params, key)) throw Error("Duplicate payment parameter");
    params[key] = value;
  }
  return params;
}

export type PayableOrder = {
  providerOrderNumber: string;
  paymentMethod: string;
  merchantId: string;
  amountCents: number;
};

/**
 * Provider data must match the stored order exactly: merchant, trade number,
 * method and amount to the cent. `notification` checks the async-notify shape;
 * otherwise the server-to-server query response shape.
 */
export function matchesPayment(
  order: PayableOrder,
  result: Record<string, unknown>,
  merchantId: string,
  notification = false,
) {
  return (
    String(result.pid) === merchantId &&
    merchantId === order.merchantId &&
    result.out_trade_no === order.providerOrderNumber &&
    result.type === order.paymentMethod &&
    moneyCents(result.money) === order.amountCents &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(String(result.trade_no || "")) &&
    (notification
      ? result.trade_status === "TRADE_SUCCESS"
      : Number(result.code) === 1 && Number(result.status) === 1)
  );
}
