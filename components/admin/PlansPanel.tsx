"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Infinity as InfinityIcon, Mail, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { AppInput } from "@/components/ui/AppInput";
import { AppNumberInput } from "@/components/ui/AppNumberInput";
import { ModelBrandIcon } from "@/components/chat/ModelBrandIcon";
import { estimateMessages, creditsPerMessage, PLAN_NAMES, type PlanConfig } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { AdminButton, AdminError, AdminSurface } from "./AdminPrimitives";

type Tier = PlanConfig["tiers"][number];
type CreditSettings = Pick<
  PlanConfig,
  "baseCredits" | "creditsPerYuan" | "freeMessages" | "usdRate"
>;
type Draft = Pick<PlanConfig, "tiers" | "contactEmail"> & { credits: CreditSettings };
const CREDIT_KEYS = ["baseCredits", "creditsPerYuan", "freeMessages", "usdRate"] as const;
const toDraft = (config: PlanConfig): Draft => ({
  tiers: config.tiers,
  contactEmail: config.contactEmail,
  credits: Object.fromEntries(CREDIT_KEYS.map((key) => [key, config[key]])) as CreditSettings,
});

const EMAIL = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;

// Mirrors parsePlans so problems show next to the field instead of as a 400.
function validate(draft: Draft) {
  const errors: Record<string, string> = {};
  draft.tiers.forEach((tier, index) => {
    if (!(tier.price >= 0.01 && tier.price <= 100000))
      errors[`${tier.id}.price`] = "月价需在 0.01～100000 之间";
    if (index === 0 && tier.multiplier !== 1) errors[`${tier.id}.multiplier`] = "基础版固定为 1 倍";
    if (index > 0 && !(tier.multiplier > draft.tiers[index - 1].multiplier))
      errors[`${tier.id}.multiplier`] = `需大于${PLAN_NAMES[draft.tiers[index - 1].id]}的倍数`;
    if (tier.multiplier > 1000) errors[`${tier.id}.multiplier`] = "倍数不能超过 1000";
  });
  if (draft.contactEmail && !EMAIL.test(draft.contactEmail))
    errors.contactEmail = "请输入有效的邮箱地址";
  const c = draft.credits;
  if (!Number.isInteger(c.baseCredits) || c.baseCredits < 1 || c.baseCredits > 1e9)
    errors.baseCredits = "需为 1 以上的整数";
  if (!(c.creditsPerYuan >= 0.01 && c.creditsPerYuan <= 1e9)) errors.creditsPerYuan = "需大于 0";
  if (!Number.isInteger(c.freeMessages) || c.freeMessages < 0 || c.freeMessages > 100_000)
    errors.freeMessages = "需为 0～100000 的整数";
  if (!(c.usdRate >= 0.01 && c.usdRate <= 1000)) errors.usdRate = "超出范围";
  return errors;
}

export function PlansPanel() {
  const [config, setConfig] = useState<PlanConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/admin/plans", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("套餐加载失败，请重试");
        return response.json();
      })
      .then((data) => {
        setConfig(data.config);
        setDraft(toDraft(data.config));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);

  const dirty = useMemo(
    () =>
      Boolean(
        config &&
        draft &&
        (draft.contactEmail !== config.contactEmail ||
          CREDIT_KEYS.some((key) => draft.credits[key] !== config[key]) ||
          draft.tiers.some(
            (tier, index) =>
              tier.price !== config.tiers[index].price ||
              tier.multiplier !== config.tiers[index].multiplier,
          )),
      ),
    [config, draft],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Sample models make the abstract multiplier concrete for each tier. They are
  // picked from the saved prices (stable while typing) and shown with the
  // draft's credit settings, so every field change updates the counts live.
  const samples = useMemo(() => {
    if (!config) return [];
    return config.models
      .filter((model) => model.unit === "mtok")
      .map((model) => ({ model, credits: creditsPerMessage(config, model) }))
      .filter(
        (item): item is { model: typeof item.model; credits: number } =>
          item.credits !== null && item.credits > 0,
      )
      .sort((a, b) => b.credits - a.credits)
      .filter((_, index, all) =>
        // Most expensive, median and cheapest priced models.
        [...new Set([0, Math.floor(all.length / 2), all.length - 1])].includes(index),
      )
      .map((item) => item.model);
  }, [config]);

  if (error) return <AdminError message={error} onRetry={() => setRetry((v) => v + 1)} />;
  if (!config || !draft) return <PlansSkeleton />;

  const errors = validate(draft);
  const invalid = Object.keys(errors).length > 0;
  const setTier = (index: number, patch: Partial<Tier>) =>
    setDraft({
      ...draft,
      tiers: draft.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    });

  async function save() {
    if (!draft || invalid) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "保存失败，请重试");
      setConfig(data.config);
      setDraft(toDraft(data.config));
      toast.success("套餐设置已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  const preview = { ...config, ...draft.credits, tiers: draft.tiers };

  return (
    <div className="space-y-4 pb-20">
      <div className="grid gap-3 lg:grid-cols-3">
        {draft.tiers.map((tier, index) => {
          const saved = config.tiers[index];
          const changed = tier.price !== saved.price || tier.multiplier !== saved.multiplier;
          const perMultiplier = tier.price / tier.multiplier;
          return (
            <AdminSurface
              className={cn("flex flex-col p-4 md:p-5", changed && "ring-1 ring-primary/30")}
              key={tier.id}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{PLAN_NAMES[tier.id]}</h3>
                <span className="flex items-center gap-1.5">
                  {changed && (
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      未保存
                    </span>
                  )}
                  {index === 1 && (
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-white/[0.08] dark:text-gray-400">
                      推荐
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-jakarta text-3xl font-semibold tabular-nums tracking-tight">
                  ¥{tier.price.toLocaleString("zh-CN")}
                </span>
                <span className="text-xs text-gray-400">/ 月</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {(draft.credits.baseCredits * tier.multiplier).toLocaleString("zh-CN")} credits / 月
                · {tier.multiplier} 倍 · 每倍 ¥
                {perMultiplier.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field error={errors[`${tier.id}.price`]} label="月价（元）">
                  <AppNumberInput
                    disabled={busy}
                    max={100000}
                    min={0.01}
                    onChange={(value) => setTier(index, { price: value ?? 0 })}
                    step={1}
                    style={{ width: "100%" }}
                    value={tier.price}
                  />
                </Field>
                <Field
                  error={errors[`${tier.id}.multiplier`]}
                  hint={index === 0 ? "基准档，固定 1 倍" : undefined}
                  label="额度倍数"
                >
                  <AppNumberInput
                    disabled={busy || index === 0}
                    max={1000}
                    min={1}
                    onChange={(value) => setTier(index, { multiplier: value ?? 1 })}
                    step={0.5}
                    style={{ width: "100%" }}
                    value={tier.multiplier}
                  />
                </Field>
              </div>

              {samples.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                  <p className="mb-2 flex items-center justify-between text-[11px] text-gray-400">
                    <span>每月约可发送</span>
                    {invalid && <span className="text-amber-600">修正设置后显示</span>}
                  </p>
                  <ul className="space-y-1.5">
                    {samples.map((model) => {
                      const [provider, ...rest] = model.key.split(":");
                      const before = estimateMessages(config, model, saved.multiplier);
                      const after = invalid
                        ? null
                        : estimateMessages(preview, model, tier.multiplier);
                      const cost = invalid ? null : creditsPerMessage(preview, model);
                      return (
                        <li className="flex items-center gap-2 text-xs" key={model.key}>
                          <ModelBrandIcon
                            model={rest.join(":") || model.key}
                            provider={provider}
                            size={16}
                          />
                          <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">
                            {model.name}
                          </span>
                          {cost !== null && (
                            <span className="shrink-0 font-jakarta text-[10px] tabular-nums text-gray-400">
                              {cost} cr/次
                            </span>
                          )}
                          {after !== null && before !== after && (
                            <span className="font-jakarta text-[11px] tabular-nums text-gray-400 line-through">
                              {before?.toLocaleString("zh-CN")}
                            </span>
                          )}
                          <span className="font-jakarta font-medium tabular-nums">
                            {after === null ? "—" : `${after.toLocaleString("zh-CN")} 条`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </AdminSurface>
          );
        })}
      </div>

      <AdminSurface className="p-4 md:p-5">
        <h3 className="text-sm font-semibold">额度设置</h3>
        <p className="mt-1 text-xs leading-5 text-gray-400">
          每次调用模型（含重试、重新生成）都会扣除一次额度。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            error={errors.baseCredits}
            hint={`进阶版、专业版按倍数计算`}
            label="基础版每月 credits"
          >
            <AppNumberInput
              disabled={busy}
              min={1}
              onChange={(value) =>
                setDraft({ ...draft, credits: { ...draft.credits, baseCredits: value ?? 0 } })
              }
              step={100}
              style={{ width: "100%" }}
              value={draft.credits.baseCredits}
            />
          </Field>
          <Field
            error={errors.creditsPerYuan}
            hint={`基础版约等于 ¥${(draft.credits.baseCredits / (draft.credits.creditsPerYuan || 1)).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 模型成本`}
            label="1 元模型成本 = credits"
          >
            <AppNumberInput
              disabled={busy}
              min={0.01}
              onChange={(value) =>
                setDraft({ ...draft, credits: { ...draft.credits, creditsPerYuan: value ?? 0 } })
              }
              step={10}
              style={{ width: "100%" }}
              value={draft.credits.creditsPerYuan}
            />
          </Field>
          <Field
            error={errors.freeMessages}
            hint="所有对免费版开放的模型共用"
            label="免费版每月对话次数"
          >
            <AppNumberInput
              disabled={busy}
              min={0}
              onChange={(value) =>
                setDraft({ ...draft, credits: { ...draft.credits, freeMessages: value ?? 0 } })
              }
              step={10}
              style={{ width: "100%" }}
              value={draft.credits.freeMessages}
            />
          </Field>
          <Field error={errors.usdRate} hint="换算美元报价的模型" label="美元汇率">
            <AppNumberInput
              disabled={busy}
              min={0.01}
              onChange={(value) =>
                setDraft({ ...draft, credits: { ...draft.credits, usdRate: value ?? 0 } })
              }
              step={0.1}
              style={{ width: "100%" }}
              value={draft.credits.usdRate}
            />
          </Field>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-gray-400">
          每个模型单次对话扣多少 credits 由其价格自动换算，也可在模型管理中单独指定。
        </p>
      </AdminSurface>

      <div className="grid gap-3 lg:grid-cols-2">
        <AdminSurface className="p-4 md:p-5">
          <div className="flex items-center gap-2">
            <Mail className="text-gray-400" size={16} />
            <h3 className="text-sm font-semibold">开通联系邮箱</h3>
          </div>
          <p className="mt-1 text-xs text-gray-400">用户在套餐弹窗点击“联系开通”时使用此地址。</p>
          <div className="mt-3">
            <Field error={errors.contactEmail}>
              <AppInput
                aria-invalid={Boolean(errors.contactEmail)}
                className="!h-10 md:!h-9"
                disabled={busy}
                onChange={(event) =>
                  setDraft({ ...draft, contactEmail: event.target.value.trim() })
                }
                placeholder="例如 billing@example.com"
                type="email"
                value={draft.contactEmail}
              />
            </Field>
          </div>
        </AdminSurface>

        <AdminSurface className="p-4 md:p-5">
          <div className="flex items-center gap-2">
            <InfinityIcon className="text-gray-400" size={16} />
            <h3 className="text-sm font-semibold">永久会员</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-400">
            仅管理员赠送，永不过期，不出现在公开购买列表中。
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link
              className="inline-flex min-h-9 items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              href="/admin/users"
            >
              在用户管理中授予 <ArrowUpRight size={13} />
            </Link>
            <Link
              className="inline-flex min-h-9 items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              href="/admin/models"
            >
              调整模型价格 <ArrowUpRight size={13} />
            </Link>
          </div>
        </AdminSurface>
      </div>

      <p className="px-1 text-[11px] leading-5 text-gray-400">
        额度按官方 API 参考价格估算：每档的积分 = 基础额度 ×
        倍数，所有模型共享；修改模型价格后各档的可用条数随之变化。
      </p>

      <div
        aria-hidden={!dirty}
        className={cn(
          "sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-[var(--chat-popover-bg)] px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.12)] transition-all duration-200 dark:border-white/10 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <p className="flex min-w-0 items-center gap-2 text-sm">
          {invalid ? (
            <>
              <TriangleAlert className="shrink-0 text-amber-500" size={15} />
              <span className="truncate">请先修正标出的字段</span>
            </>
          ) : (
            <span className="truncate text-gray-600 dark:text-gray-300">有未保存的套餐修改</span>
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <AdminButton disabled={busy} onClick={() => setDraft(toDraft(config))}>
            放弃修改
          </AdminButton>
          <AdminButton disabled={invalid} loading={busy} onClick={() => void save()} primary>
            保存
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      {label && <span className="mb-1.5 block text-xs text-gray-500">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>
      )}
    </label>
  );
}

function PlansSkeleton() {
  return (
    <div aria-busy="true" aria-label="正在加载套餐" className="animate-pulse space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div className="h-[300px] rounded-xl bg-gray-100 dark:bg-white/[0.04]" key={key} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map((key) => (
          <div className="h-36 rounded-xl bg-gray-100 dark:bg-white/[0.04]" key={key} />
        ))}
      </div>
    </div>
  );
}
