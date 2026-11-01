"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Gift, LogIn } from "lucide-react";

import { PLAN_NAMES } from "@/lib/plans";
import { cn } from "@/lib/utils";

import { ModelBrandIcon } from "./ModelBrandIcon";

type GuestTier = {
  id: "starter" | "plus" | "pro";
  price: number;
  multiplier: number;
  credits: number;
  models: { key: string; name: string; category: string; messages: number | null }[];
};
type GuestPlans = {
  freeMessages: number;
  freeModels: number;
  payment: { enabled: boolean };
  tiers: GuestTier[];
};

const TAGLINES: Record<GuestTier["id"], string> = {
  starter: "日常问答与写作",
  plus: "高频使用，长对话更从容",
  pro: "复杂任务与大量调用",
};

const SAMPLE_COUNT = 4;
// Well-known closed models first, then open models; each vendor's most
// generous model represents it so cards never lead with a scarce flagship.
const VENDORS: { pattern: RegExp; closed: boolean }[] = [
  { pattern: /\bgpt|^o\d/i, closed: true },
  { pattern: /claude/i, closed: true },
  { pattern: /gemini/i, closed: true },
  { pattern: /grok/i, closed: true },
  { pattern: /deepseek/i, closed: false },
  { pattern: /qwen/i, closed: false },
  { pattern: /doubao|seed/i, closed: false },
  { pattern: /glm/i, closed: false },
  { pattern: /kimi/i, closed: false },
];
// Below this a model reads as scarce on a paid card; skip it.
const MIN_MESSAGES = 100;

const pickSamples = (tier: GuestTier) => {
  const best = VENDORS.flatMap(({ pattern, closed }) => {
    const model = tier.models
      .filter((item) => pattern.test(item.name) && (item.messages ?? 0) >= MIN_MESSAGES)
      .sort((a, b) => (b.messages ?? 0) - (a.messages ?? 0))[0];
    return model ? [{ model, closed }] : [];
  });
  const closed = best.filter((item) => item.closed);
  const open = best.filter((item) => !item.closed);
  // Up to two closed models, then fill with open ones (or more closed ones).
  const picked = [...closed.slice(0, 2), ...open, ...closed.slice(2)].slice(0, SAMPLE_COUNT);
  return picked
    .sort((a, b) => (b.model.messages ?? 0) - (a.model.messages ?? 0))
    .map((item) => item.model.key);
};

const formatCount = (value: number) =>
  value >= 10000
    ? `${(value / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} 万`
    : value.toLocaleString("zh-CN");

/**
 * Plans overview for anonymous visitors below the welcome composer. Uses the
 * public catalog only; choosing a plan asks the visitor to sign in first.
 */
export function GuestPlansSection({ onSignIn }: { onSignIn: () => void }) {
  const [plans, setPlans] = useState<GuestPlans | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/plans", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setPlans)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const sampleKeys = useMemo(() => (plans?.tiers[0] ? pickSamples(plans.tiers[0]) : []), [plans]);

  if (failed) return null;

  return (
    <section aria-labelledby="guest-plans-title" className="mt-10 w-full md:mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h2
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            id="guest-plans-title"
          >
            订阅套餐
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            一个会员使用全部主流模型，所有模型共享月度额度，按月开通、不自动续费。
          </p>
        </div>
        {plans && plans.freeMessages > 0 && (
          <p className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Gift className="text-gray-400" size={13} />
            注册即送每月 {plans.freeMessages} 次免费对话
          </p>
        )}
      </div>

      {!plans ? (
        <div aria-busy="true" aria-label="正在加载套餐" className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              className="h-[268px] animate-pulse rounded-xl bg-gray-100 dark:bg-white/[0.04]"
              key={key}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.tiers.map((tier, index) => {
            const featured = index === 1;
            const samples = sampleKeys.flatMap(
              (key) => tier.models.find((model) => model.key === key) ?? [],
            );
            return (
              <article
                className={cn(
                  "relative flex min-w-0 flex-col rounded-xl border bg-[var(--chat-panel-bg)] p-4 transition-colors",
                  featured
                    ? "border-gray-900 dark:border-white/50"
                    : "border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20",
                )}
                key={tier.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{PLAN_NAMES[tier.id]}</h3>
                  {featured && (
                    <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-gray-900">
                      推荐
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-gray-400">{TAGLINES[tier.id]}</p>
                <p className="mt-3 flex items-baseline">
                  <span className="mr-0.5 text-sm font-medium">¥</span>
                  <span className="font-jakarta text-[28px] font-semibold leading-none tracking-tight tabular-nums">
                    {tier.price}
                  </span>
                  <span className="ml-1 text-xs text-gray-400">/ 月</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="shrink-0 text-gray-900 dark:text-gray-100" size={13} />
                    每月 {tier.credits.toLocaleString("zh-CN")} credits
                  </li>
                </ul>
                {samples.length > 0 && (
                  <div className="mb-4 mt-3 rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-white/[0.04]">
                    <p className="mb-1.5 text-[10px] text-gray-400">每月约可对话</p>
                    <ul className="space-y-1.5">
                      {samples.map((model) => (
                        <li className="flex min-w-0 items-center gap-1.5 text-xs" key={model.key}>
                          <ModelBrandIcon model={model.name} size={14} />
                          <span
                            className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300"
                            data-markai-tooltip={model.name}
                          >
                            {model.name}
                          </span>
                          <span className="shrink-0 font-jakarta font-semibold tabular-nums">
                            {formatCount(model.messages ?? 0)}
                            <span className="ml-0.5 font-sans font-normal text-gray-400">次</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  className={cn(
                    "mt-auto flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors md:min-h-9",
                    featured
                      ? "bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                      : "border border-gray-200 text-gray-800 hover:bg-gray-50 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/[0.05]",
                  )}
                  onClick={onSignIn}
                  type="button"
                >
                  登录后开通
                  <ArrowRight size={14} />
                </button>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3 sm:flex-row dark:border-white/10">
        <p className="text-center text-xs text-gray-500 sm:text-left dark:text-gray-400">
          已有账户？登录后同步历史对话、文件与个性化设置
        </p>
        <button
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-800 hover:bg-gray-100 md:min-h-8 dark:text-gray-100 dark:hover:bg-white/[0.07]"
          onClick={onSignIn}
          type="button"
        >
          <LogIn size={15} />
          登录 / 注册
        </button>
      </div>
    </section>
  );
}
