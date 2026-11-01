import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("./plans", () => ({ readPlans: vi.fn() }));

const { paymentAvailability, paymentConfig, paymentReturnOrigin } = await import("./payments");

const env = (values: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value as string);
};

afterEach(() => vi.unstubAllEnvs());

describe("paymentConfig", () => {
  const merchant = { ZPAY_PID: "1001001", ZPAY_KEY: "abcdefghijklmnop1234" };

  it("enables payments locally when APP_URL is localhost and a public site is set", () => {
    env({
      ...merchant,
      APP_URL: "http://localhost:3000",
      PAYMENT_NOTIFY_URL: "https://ai.example.com",
    });
    expect(paymentAvailability()).toEqual({ enabled: true, methods: ["alipay", "wxpay"] });
    expect(paymentConfig().site).toBe("https://ai.example.com");
  });

  it("needs only APP_URL in production", () => {
    env({
      ...merchant,
      APP_URL: "https://ai.example.com",
      PAYMENT_NOTIFY_URL: "",
      MARKAI_SITE_URL: "",
    });
    expect(paymentConfig().site).toBe("https://ai.example.com");
  });

  it("still reads the legacy MARKAI_SITE_URL", () => {
    env({
      ...merchant,
      APP_URL: "http://localhost:3000",
      MARKAI_SITE_URL: "https://old.example.com",
    });
    expect(paymentConfig().site).toBe("https://old.example.com");
  });

  it("requires some public https site for the notify callback", () => {
    env({
      ...merchant,
      APP_URL: "http://localhost:3000",
      PAYMENT_NOTIFY_URL: "",
      MARKAI_SITE_URL: "",
    });
    expect(paymentAvailability().enabled).toBe(false);
  });

  it("uses the configured public site and methods", () => {
    env({ ...merchant, PAYMENT_NOTIFY_URL: "https://ai.example.com", ZPAY_METHODS: "alipay" });
    expect(paymentConfig()).toMatchObject({ site: "https://ai.example.com", methods: ["alipay"] });
  });

  it("stays disabled without merchant credentials or with an unknown gateway", () => {
    env({ ZPAY_PID: "", ZPAY_KEY: "" });
    expect(paymentAvailability().enabled).toBe(false);
    env({
      ...merchant,
      PAYMENT_NOTIFY_URL: "https://ai.example.com",
      ZPAY_API_BASE: "https://evil.example.com",
    });
    expect(paymentAvailability().enabled).toBe(false);
  });
});

it("returns the browser to loopback or the public site, never elsewhere", () => {
  const site = "https://ai.example.com";
  expect(paymentReturnOrigin("http://localhost:3000", site)).toBe("http://localhost:3000");
  expect(paymentReturnOrigin("https://evil.example.com", site)).toBe(site);
  expect(paymentReturnOrigin(undefined, site)).toBe(site);
});
