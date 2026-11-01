"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, ExternalLink, LoaderCircle, Mail, RefreshCw } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import Image from "@/components/ui/AppImage";
import { cn } from "@/lib/utils";
import { PLAN_NAMES, type PlanId } from "@/lib/plans";

export type CheckoutTier = {
  id: Exclude<PlanId, "free" | "lifetime">;
  price: number;
  credits: number;
  renew: boolean;
};
type Method = "alipay" | "wxpay";
type Checkout = {
  orderNumber: string;
  amountCents: number;
  method: Method;
  expiresAt: string;
  qrImage?: string;
  payUrl?: string;
};
type Phase =
  | { step: "choose" }
  | { step: "creating" }
  | { step: "paying"; checkout: Checkout; qr?: string }
  | { step: "paid"; expiresAt: string | null }
  | { step: "expired" }
  | { step: "error"; message: string };

const METHOD_LABEL: Record<Method, string> = { alipay: "支付宝", wxpay: "微信支付" };
const METHOD_COLOR: Record<Method, string> = { alipay: "#1677ff", wxpay: "#07c160" };

/** Brand mark for a payment method; the label stays as visible text beside it. */
function MethodMark({ method, size = 18 }: { method: Method; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      className="shrink-0"
      height={size}
      src={`/images/payment/${method}.svg`}
      width={size}
    />
  );
}
const POLL_MS = 3_000;

export function CheckoutDialog({
  tier,
  payment,
  contactEmail,
  currentExpiresAt,
  onClose,
  onPaid,
}: {
  tier: CheckoutTier;
  payment: { enabled: boolean; methods: Method[] };
  contactEmail: string;
  currentExpiresAt: string | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<Method>(payment.methods[0] || "alipay");
  const [phase, setPhase] = useState<Phase>({ step: "choose" });
  const [now, setNow] = useState(Date.now());
  const paidRef = useRef(false);
  const name = PLAN_NAMES[tier.id];

  const start = useCallback(async () => {
    setPhase({ step: "creating" });
    try {
      const response = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tier.id, method }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "创建订单失败，请稍后重试");
      const checkout = data as Checkout;
      setPhase({ step: "paying", checkout, qr: checkout.qrImage });
    } catch (e) {
      setPhase({ step: "error", message: e instanceof Error ? e.message : "创建订单失败" });
    }
  }, [method, tier.id]);

  // Poll the order while the QR is shown; also re-check when the tab regains focus,
  // which is when users return from the Alipay app or provider page.
  const orderNumber = phase.step === "paying" ? phase.checkout.orderNumber : undefined;
  useEffect(() => {
    if (!orderNumber) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (timer) clearTimeout(timer);
      try {
        const response = await fetch(`/api/payments/orders/${orderNumber}`, { cache: "no-store" });
        const data = await response.json();
        if (!active) return;
        if (response.ok && data.status === "paid") {
          if (!paidRef.current) {
            paidRef.current = true;
            setPhase({ step: "paid", expiresAt: data.membershipExpiresAt });
          }
          return;
        }
        if (response.ok && data.status === "expired") {
          setPhase({ step: "expired" });
          return;
        }
      } catch {
        // Network hiccup: keep polling.
      }
      if (active) timer = setTimeout(check, POLL_MS);
    };
    const onFocus = () => document.visibilityState === "visible" && void check();
    timer = setTimeout(check, POLL_MS);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [orderNumber]);

  useEffect(() => {
    if (phase.step !== "paying") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase.step]);

  const busy = phase.step === "creating";
  const extendFrom =
    tier.renew && currentExpiresAt && Date.parse(currentExpiresAt) > Date.now()
      ? new Date(currentExpiresAt)
      : new Date();
  const newExpiry = new Date(extendFrom.getTime() + 30 * 86_400_000).toLocaleDateString("zh-CN");

  return (
    <AppDialog
      closeDisabled={busy}
      maskClosable={phase.step !== "paying"}
      onClose={phase.step === "paid" ? onPaid : onClose}
      open
      title={phase.step === "paid" ? "开通成功" : `${tier.renew ? "续费" : "开通"}${name}`}
      width={440}
      zIndex={1300}
    >
      <div className="p-5">
        {phase.step === "paid" ? (
          <div className="py-4 text-center">
            <CircleCheck className="mx-auto text-emerald-500" size={44} strokeWidth={1.6} />
            <p className="mt-4 text-base font-semibold">{name}已生效</p>
            <p className="mt-1 text-sm text-gray-500">
              有效期至{" "}
              {phase.expiresAt ? new Date(phase.expiresAt).toLocaleDateString("zh-CN") : newExpiry}
            </p>
            <button
              className="mt-6 min-h-11 w-full rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              onClick={onPaid}
              type="button"
            >
              开始使用
            </button>
          </div>
        ) : phase.step === "paying" ? (
          <PayingView
            checkout={phase.checkout}
            now={now}
            onRestart={() => setPhase({ step: "choose" })}
            qr={phase.qr}
          />
        ) : (
          <>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-white/[0.04]">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">{name} · 1 个月</span>
                <span className="font-jakarta text-2xl font-semibold tabular-nums">
                  ¥{tier.price}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5 border-t border-gray-200/70 pt-3 text-xs dark:border-white/[0.07]">
                <div className="flex justify-between">
                  <dt className="text-gray-400">每月积分</dt>
                  <dd className="font-jakarta tabular-nums">
                    {tier.credits.toLocaleString("zh-CN")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">开通后有效期至</dt>
                  <dd>{newExpiry}</dd>
                </div>
              </dl>
            </div>

            {payment.enabled ? (
              <>
                {payment.methods.length === 1 && (
                  <div className="mt-4 flex min-h-11 items-center justify-between rounded-lg border border-gray-200 px-3 text-sm dark:border-white/10">
                    <span className="text-gray-500">支付方式</span>
                    <span className="flex items-center gap-2 font-medium">
                      <MethodMark method={method} />
                      {METHOD_LABEL[method]}
                    </span>
                  </div>
                )}
                {payment.methods.length > 1 && (
                  <div
                    className="mt-4 grid grid-cols-2 gap-2"
                    role="radiogroup"
                    aria-label="支付方式"
                  >
                    {payment.methods.map((value) => (
                      <button
                        aria-checked={method === value}
                        className={cn(
                          "flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm transition-colors",
                          method === value
                            ? "border-gray-900 font-medium dark:border-white"
                            : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-white/10",
                        )}
                        key={value}
                        onClick={() => setMethod(value)}
                        role="radio"
                        type="button"
                      >
                        <MethodMark method={value} />
                        {METHOD_LABEL[value]}
                      </button>
                    ))}
                  </div>
                )}
                {phase.step === "error" && (
                  <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                    {phase.message}
                  </p>
                )}
                {phase.step === "expired" && (
                  <p className="mt-4 text-sm text-amber-700 dark:text-amber-400" role="status">
                    订单已超时，请重新发起支付。如已付款，系统会自动核对并开通。
                  </p>
                )}
                <button
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white transition-[filter] hover:brightness-95 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void start()}
                  style={{ backgroundColor: METHOD_COLOR[method] }}
                  type="button"
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" size={15} />
                  ) : (
                    <span className="flex rounded-[5px] ring-1 ring-white/70">
                      <MethodMark method={method} />
                    </span>
                  )}
                  {busy ? "正在创建订单…" : `使用${METHOD_LABEL[method]}支付 ¥${tier.price}`}
                </button>
                <p className="mt-3 text-center text-[11px] leading-5 text-gray-400">
                  一次性付款，不会自动续费。付款即表示同意按月提供的会员服务。
                </p>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm leading-6 text-gray-500">
                  在线支付暂未开通。联系管理员确认费用，付款后为你的账号开通会员。
                </p>
                {contactEmail ? (
                  <a
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(`申请开通 MarkAI ${name}`)}`}
                  >
                    <Mail size={15} />
                    {contactEmail}
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">请通过现有联系渠道联系管理员。</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppDialog>
  );
}

function PayingView({
  checkout,
  qr,
  now,
  onRestart,
}: {
  checkout: Checkout;
  qr?: string;
  now: number;
  onRestart: () => void;
}) {
  const left = Math.max(0, Date.parse(checkout.expiresAt) - now);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return (
    <div className="text-center">
      <p className="font-jakarta text-3xl font-semibold tabular-nums">
        <span className="mr-0.5 text-lg">¥</span>
        {(checkout.amountCents / 100).toFixed(2)}
      </p>
      {qr ? (
        <>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
            <MethodMark method={checkout.method} size={20} />
            {METHOD_LABEL[checkout.method]}扫码支付
          </p>
          <div
            className="relative mx-auto mt-3 w-56 rounded-xl border-2 bg-white p-3"
            style={{ borderColor: METHOD_COLOR[checkout.method] }}
          >
            <Image
              alt={`${METHOD_LABEL[checkout.method]}付款二维码`}
              containerClassName="!block"
              height={200}
              native
              placeholderAspectRatio="1 / 1"
              src={qr}
              width={200}
            />
            {/* Center mark, as on official payment codes; small enough for level-M error correction. */}
            <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-1">
              <MethodMark method={checkout.method} size={28} />
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            打开{METHOD_LABEL[checkout.method]} App，扫一扫完成付款
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500">请在新打开的页面中完成付款</p>
      )}
      {checkout.payUrl && (
        <a
          className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
          href={checkout.payUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MethodMark method={checkout.method} size={16} />
          在本设备打开{METHOD_LABEL[checkout.method]}
          <ExternalLink size={12} />
        </a>
      )}
      <p
        className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400"
        role="status"
      >
        <LoaderCircle className="animate-spin" size={13} />
        等待付款确认 · 剩余 {minutes}:{seconds.toString().padStart(2, "0")}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-[11px] text-gray-400 dark:border-white/[0.06]">
        <span className="font-jakarta">订单 {checkout.orderNumber}</span>
        <button
          className="inline-flex min-h-8 items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
          onClick={onRestart}
          type="button"
        >
          <RefreshCw size={12} /> 重新下单
        </button>
      </div>
    </div>
  );
}
