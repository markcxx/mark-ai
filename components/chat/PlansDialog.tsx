"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Infinity as InfinityIcon,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/utils";
import { PLAN_NAMES, type ModelPrice, type PlanId } from "@/lib/plans";
import { ModelBrandIcon } from "./ModelBrandIcon";
import { CheckoutDialog, type CheckoutTier } from "./plans/CheckoutDialog";

type Model = {
  key: string;
  name: string;
  messages: number | null;
  priceStatus: ModelPrice["status"];
  category: "flagship" | "everyday";
};
type Tier = {
  id: Exclude<PlanId, "free" | "lifetime">;
  name: string;
  price: number;
  multiplier: number;
  credits: number;
  models: Model[];
};
export type PlansData = {
  tiers: Tier[];
  membership: { tier: PlanId; expiresAt: string | null };
  contactEmail: string;
  inputTokens: number;
  outputTokens: number;
  payment: { enabled: boolean; methods: ("alipay" | "wxpay")[] };
};

const TIER_COPY: Record<Tier["id"], { tagline: string; perks: string[] }> = {
  starter: {
    tagline: "偶尔使用 AI，轻松处理日常任务",
    perks: ["全部站点模型可用", "对话、文件与工具集中管理", "所有模型共享一份额度"],
  },
  plus: {
    tagline: "频繁使用 AI，让工作与创作更从容",
    perks: ["基础版的全部权益", "约 3 倍月度额度", "更适合长对话与深度推理"],
  },
  pro: {
    tagline: "高频与复杂任务，额度更充裕",
    perks: ["进阶版的全部权益", "最高月度额度", "适合大量文件与工具调用"],
  },
};

// Representative models: one recognizable name per family, in a stable order.
const FLAGSHIP = [
  /opus/i,
  /gpt.*sol/i,
  /sonnet/i,
  /gemini.*pro/i,
  /glm/i,
  /kimi/i,
  /qwen/i,
  /grok/i,
];
const EVERYDAY = [/deepseek/i, /haiku/i, /gemini.*flash/i, /glm.*flash/i, /minimax/i, /mimo/i];
function examples(models: Model[], category: Model["category"], limit = 4) {
  const candidates = models
    .filter((m) => m.category === category && m.messages !== null)
    .sort((a, b) => b.name.localeCompare(a.name, "en", { numeric: true }));
  const result: Model[] = [];
  for (const pattern of category === "flagship" ? FLAGSHIP : EVERYDAY) {
    const match = candidates.find((m) => pattern.test(m.name) && !result.includes(m));
    if (match) result.push(match);
  }
  for (const m of candidates) if (result.length < limit && !result.includes(m)) result.push(m);
  return result.slice(0, limit);
}

const formatCount = (value: number) =>
  value >= 10000
    ? `${(value / 10000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} 万`
    : value.toLocaleString("zh-CN");

export function PlansDialog({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<PlansData | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [checkout, setCheckout] = useState<CheckoutTier>();
  const [compare, setCompare] = useState(false);
  const [category, setCategory] = useState<"all" | Model["category"]>("all");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/plans", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("套餐加载失败，请检查网络后重试");
        return response.json();
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);

  const membership = data?.membership;
  const permanent = membership?.tier === "lifetime";
  const currentIndex = data?.tiers.findIndex((tier) => tier.id === membership?.tier) ?? -1;
  const expires =
    membership?.expiresAt && new Date(membership.expiresAt).toLocaleDateString("zh-CN");

  return (
    <AppDialog
      bodyClassName="!p-0"
      headerClassName="!border-0 !pb-0"
      onClose={onClose}
      open
      title={false}
      width={1120}
    >
      <div className="px-4 pb-6 sm:px-8 sm:pb-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            MarkAI Plans
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
            一个会员，所有主流模型
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            从轻量日常到旗舰推理自由切换，所有模型共享同一份月度额度。
          </p>
          {membership && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 dark:border-white/10 dark:text-gray-300">
              {permanent ? <InfinityIcon size={13} /> : <ShieldCheck size={13} />}
              当前：{PLAN_NAMES[membership.tier]}
              {permanent ? " · 永久有效" : expires ? ` · ${expires} 到期` : ""}
            </p>
          )}
        </header>

        {error ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-sm text-gray-500">
            {error}
            <button
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
              onClick={() => setRetry((v) => v + 1)}
              type="button"
            >
              <RefreshCw size={14} /> 重新加载
            </button>
          </div>
        ) : !data ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                className="h-[520px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5"
                key={i}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-8 grid items-stretch gap-4 md:grid-cols-3">
              {data.tiers.map((tier, index) => (
                <PlanCard
                  current={tier.id === membership?.tier}
                  disabledReason={
                    permanent ? "永久会员已开通" : currentIndex > index ? "低于当前套餐" : undefined
                  }
                  featured={index === 1}
                  key={tier.id}
                  onSelect={() =>
                    setCheckout({
                      id: tier.id,
                      price: tier.price,
                      credits: tier.credits,
                      renew: tier.id === membership?.tier,
                    })
                  }
                  tier={tier}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
              {[
                data.payment.enabled ? "支付宝安全支付" : "联系管理员开通",
                "按月开通，到期不自动续费",
                "开通后立即生效",
              ].map((label) => (
                <span className="inline-flex items-center gap-1.5" key={label}>
                  <Check className="text-emerald-500" size={13} />
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-8 border-t border-gray-100 pt-6 dark:border-white/[0.06]">
              <button
                aria-expanded={compare}
                className="mx-auto flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                onClick={() => setCompare((v) => !v)}
                type="button"
              >
                {compare ? "收起模型额度对比" : "查看各模型的额度对比"}
                <ChevronDown
                  className={cn("transition-transform duration-200", compare && "rotate-180")}
                  size={15}
                />
              </button>
              {compare && (
                <CompareTable category={category} data={data} onCategoryChange={setCategory} />
              )}
            </div>

            <p className="mx-auto mt-6 max-w-3xl text-center text-[11px] leading-6 text-gray-400">
              条数按单次 {data.inputTokens.toLocaleString()} 输入 /{" "}
              {data.outputTokens.toLocaleString()} 输出 tokens
              估算，为全部额度只用于该模型时的参考值，不可相加；实际用量随上下文长度、推理与工具调用变化。
            </p>
          </>
        )}
      </div>
      {checkout && data && (
        <CheckoutDialog
          payment={data.payment}
          contactEmail={data.contactEmail}
          currentExpiresAt={membership?.expiresAt ?? null}
          onClose={() => setCheckout(undefined)}
          onPaid={() => {
            setCheckout(undefined);
            setRetry((v) => v + 1);
          }}
          tier={checkout}
        />
      )}
    </AppDialog>
  );
}

function PlanCard({
  tier,
  featured,
  current,
  disabledReason,
  onSelect,
}: {
  tier: Tier;
  featured: boolean;
  current: boolean;
  disabledReason?: string;
  onSelect: () => void;
}) {
  const copy = TIER_COPY[tier.id];
  const samples = useMemo(
    () => [...examples(tier.models, "flagship", 3), ...examples(tier.models, "everyday", 2)],
    [tier.models],
  );
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col rounded-2xl border p-5 transition-shadow lg:p-6",
        featured
          ? "border-gray-900 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)] dark:border-white/40 dark:bg-[#1c1c1e]"
          : "border-gray-200 bg-white dark:border-white/10 dark:bg-[#161618]",
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 px-3 py-1 text-[11px] font-medium text-white dark:bg-white dark:text-gray-900">
          最受欢迎
        </span>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{PLAN_NAMES[tier.id]}</h3>
        {current && (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            当前套餐
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{copy.tagline}</p>

      <p className="mt-5 flex items-baseline">
        <span className="mr-0.5 text-lg font-medium">¥</span>
        <span className="font-jakarta text-[44px] font-semibold leading-none tracking-tight tabular-nums">
          {tier.price}
        </span>
        <span className="ml-1.5 text-xs text-gray-400">/ 月</span>
      </p>
      <p className="mt-2 text-xs text-gray-500">
        每月{" "}
        <span className="font-jakarta font-semibold text-gray-900 dark:text-gray-100">
          {formatCount(tier.credits)}
        </span>{" "}
        积分 · {tier.multiplier}× 基础额度
      </p>

      <button
        className={cn(
          "mt-5 flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed",
          featured
            ? "bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
            : "border border-gray-200 text-gray-900 hover:bg-gray-50 disabled:text-gray-400 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/5 dark:disabled:text-gray-500",
        )}
        disabled={Boolean(disabledReason)}
        onClick={onSelect}
        type="button"
      >
        {disabledReason || (current ? "续费一个月" : `开通${PLAN_NAMES[tier.id]}`)}
        {!disabledReason && <ArrowRight size={15} />}
      </button>

      <ul className="mt-6 space-y-2.5 text-sm text-gray-600 dark:text-gray-300">
        {copy.perks.map((perk) => (
          <li className="flex items-start gap-2" key={perk}>
            <Check className="mt-0.5 shrink-0 text-gray-900 dark:text-gray-100" size={15} />
            {perk}
          </li>
        ))}
      </ul>

      {samples.length > 0 && (
        <div className="mt-6 rounded-xl bg-gray-50 p-3.5 dark:bg-white/[0.04]">
          <p className="mb-2.5 text-[11px] text-gray-400">每月约可发送</p>
          <ul className="space-y-2">
            {samples.map((model) => (
              <li className="flex items-center gap-2 text-xs" key={model.key}>
                <ModelBrandIcon model={model.name} size={16} />
                <span
                  className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300"
                  data-markai-tooltip={model.name}
                >
                  {model.name}
                </span>
                <span className="shrink-0 font-jakarta font-semibold tabular-nums">
                  {formatCount(model.messages ?? 0)}
                  <span className="ml-0.5 font-sans font-normal text-gray-400">条</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CompareTable({
  data,
  category,
  onCategoryChange,
}: {
  data: PlansData;
  category: "all" | Model["category"];
  onCategoryChange: (value: "all" | Model["category"]) => void;
}) {
  const rows = data.tiers[0].models.filter((m) => category === "all" || m.category === category);
  return (
    <div className="mt-4">
      <SegmentedControl<"all" | Model["category"]>
        onChange={onCategoryChange}
        options={[
          { value: "all", label: "全部模型" },
          { value: "flagship", label: "旗舰模型" },
          { value: "everyday", label: "日常模型" },
        ]}
        value={category}
      />
      <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-gray-200 dark:border-white/10">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-[#1c1c1e] dark:text-gray-400">
            <tr>
              <th className="px-4 py-2.5 font-normal">模型</th>
              {data.tiers.map((tier) => (
                <th className="px-4 py-2.5 text-right font-normal" key={tier.id}>
                  {PLAN_NAMES[tier.id]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((model) => (
              <tr className="border-t border-gray-100 dark:border-white/[0.05]" key={model.key}>
                <td className="px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <ModelBrandIcon model={model.name} size={16} />
                    <span className="truncate">{model.name}</span>
                    {model.priceStatus !== "verified" && (
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {model.priceStatus === "estimated" ? "估算" : "参考价"}
                      </span>
                    )}
                  </span>
                </td>
                {data.tiers.map((tier) => {
                  const count = tier.models.find((m) => m.key === model.key)?.messages;
                  return (
                    <td className="px-4 py-2.5 text-right font-jakarta tabular-nums" key={tier.id}>
                      {count == null ? (
                        <span className="text-gray-400">待补充</span>
                      ) : (
                        `${formatCount(count)} 条`
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
