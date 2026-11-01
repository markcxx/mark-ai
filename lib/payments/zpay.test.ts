import { describe, expect, it } from "vitest";
import { matchesPayment, moneyCents, parseZpayParams, validZpaySignature, zpaySign } from "./zpay";

const KEY = "test-merchant-key-0000";

describe("zpay signing", () => {
  it("signs sorted non-empty params and ignores sign fields", () => {
    const a = zpaySign({ b: "2", a: "1", empty: "", sign: "x", sign_type: "MD5" }, KEY);
    const b = zpaySign({ a: "1", b: "2" }, KEY);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{32}$/);
  });
  it("verifies a valid signature and rejects tampering", () => {
    const params: Record<string, string> = { pid: "1001", money: "39.00", out_trade_no: "123" };
    params.sign = zpaySign(params, KEY);
    params.sign_type = "MD5";
    expect(validZpaySignature(params, KEY)).toBe(true);
    expect(validZpaySignature({ ...params, money: "0.01" }, KEY)).toBe(false);
    expect(validZpaySignature({ ...params, sign_type: "RSA" }, KEY)).toBe(false);
  });
});

it("parses money to cents strictly", () => {
  expect(moneyCents("39")).toBe(3900);
  expect(moneyCents("39.5")).toBe(3950);
  expect(moneyCents("0.01")).toBe(1);
  expect(moneyCents("1e3")).toBeNull();
  expect(moneyCents("-1")).toBeNull();
  expect(moneyCents(39)).toBeNull();
});

it("rejects duplicate query parameters", () => {
  expect(() => parseZpayParams("?a=1&a=2")).toThrow();
  expect(parseZpayParams("?a=1&b=2")).toEqual({ a: "1", b: "2" });
});

describe("matchesPayment", () => {
  const order = {
    providerOrderNumber: "1700000000000123456789",
    paymentMethod: "alipay",
    merchantId: "1001",
    amountCents: 3900,
  };
  const notify = {
    pid: "1001",
    out_trade_no: order.providerOrderNumber,
    type: "alipay",
    money: "39.00",
    trade_no: "2026110122001",
    trade_status: "TRADE_SUCCESS",
  };
  it("accepts an exact notification", () => {
    expect(matchesPayment(order, notify, "1001", true)).toBe(true);
  });
  it("rejects amount, merchant, method or status mismatches", () => {
    expect(matchesPayment(order, { ...notify, money: "0.01" }, "1001", true)).toBe(false);
    expect(matchesPayment(order, { ...notify, pid: "9999" }, "1001", true)).toBe(false);
    expect(matchesPayment(order, { ...notify, type: "wxpay" }, "1001", true)).toBe(false);
    expect(matchesPayment(order, { ...notify, trade_status: "WAIT" }, "1001", true)).toBe(false);
  });
  it("uses code/status for query responses", () => {
    const query = { ...notify, trade_status: undefined, code: 1, status: 1 };
    expect(matchesPayment(order, query, "1001")).toBe(true);
    expect(matchesPayment(order, { ...query, status: 0 }, "1001")).toBe(false);
  });
});
