"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { AppInput } from "@/components/ui/AppInput";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { ModelBrandIcon } from "@/components/chat/ModelBrandIcon";
import { getModelDisplayName, getModelKey } from "@/lib/chat/helpers";
import type { ConfiguredModel } from "@/lib/chat/types";
import type { ModelPresentation } from "@/lib/model-presentation";
import {
  DEFAULT_PLANS,
  estimateMessages,
  creditsPerMessage,
  PLAN_NAMES,
  type PlanConfig,
  type PlanModel,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import { AdminButton } from "./AdminPrimitives";

export type ModelEstimation = Pick<
  PlanConfig,
  "baseCredits" | "creditsPerYuan" | "inputTokens" | "outputTokens" | "usdRate"
> &
  Partial<Pick<PlanConfig, "tiers">>;
export type AdminModel = ConfiguredModel & {
  developer: { id: string; name: string };
  providerName: string;
  presentation: ModelPresentation;
  pricing: PlanModel;
};

export type PriceState = "missing" | "custom" | "estimated" | "warning" | "verified";

export const PRICE_STATE_LABELS: Record<PriceState, string> = {
  missing: "待补充价格",
  custom: "自定义价格",
  estimated: "估算价",
  warning: "待核实",
  verified: "原厂报价",
};

export function priceState(pricing: PlanModel): PriceState {
  if (pricing.input === null || pricing.output === null) return "missing";
  if (pricing.priceOverride) return "custom";
  if (pricing.status === "estimated") return "estimated";
  if (pricing.status !== "verified") return "warning";
  return "verified";
}

const priceStateClass: Record<PriceState, string> = {
  missing: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  custom: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  estimated: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  verified: "bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-gray-400",
};

export function PriceStateBadge({ pricing }: { pricing: PlanModel }) {
  const state = priceState(pricing);
  const label =
    state === "warning"
      ? ({ historical: "历史参考", retired: "原渠道已下线", unverified: "待核实" } as const)[
          pricing.status as "historical" | "retired" | "unverified"
        ] || PRICE_STATE_LABELS.warning
      : PRICE_STATE_LABELS[state];
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        priceStateClass[state],
      )}
    >
      {label}
    </span>
  );
}

export const modelName = (model: AdminModel) =>
  model.presentation.displayName || getModelDisplayName(model.id);

export const priceUnit = (pricing: PlanModel) =>
  `${pricing.currency === "USD" ? "$" : "¥"} / ${pricing.unit === "image" ? "张" : "百万 tokens"}`;

export const formatAmount = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });

export function formatPrice(pricing: Pick<PlanModel, "currency">, value: number | null) {
  if (value === null) return "—";
  return `${pricing.currency === "USD" ? "$" : "¥"}${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
}

const decimal = (value: string) =>
  value.trim() &&
  /^\d*(?:\.\d+)?$/.test(value.trim()) &&
  Number(value) >= 0 &&
  Number(value) <= 1000000
    ? Number(value)
    : null;

/** Messages per month on the base tier; "不消耗" when the model is free. */
export function baseQuota(estimation: ModelEstimation, pricing: PlanModel) {
  const config = { ...DEFAULT_PLANS, ...estimation };
  const credits = creditsPerMessage(config, pricing);
  return { credits, messages: estimateMessages(config, pricing, 1) };
}

/** Price editor with an explicit save and a live per-tier quota preview. */
export function ModelPriceDialog({
  model,
  estimation,
  onClose,
  onSave,
}: {
  model?: AdminModel;
  estimation: ModelEstimation;
  onClose: () => void;
  onSave: (
    model: AdminModel,
    prices: {
      input: number | null;
      output: number | null;
      freeAccess: boolean;
      creditsOverride: number | null;
    },
    priceChanged: boolean,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ input: "", output: "", free: false, credits: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const key = model ? getModelKey(model) : "";
  useEffect(() => {
    if (!model) return;
    setDraft({
      credits: model.pricing.creditsOverride?.toString() ?? "",
      free: model.pricing.freeAccess,
      input: model.pricing.input?.toString() ?? "",
      output: model.pricing.output?.toString() ?? "",
    });
    setError("");
    // Only reset when a different model opens, never mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const input = decimal(draft.input);
  const output = decimal(draft.output);
  const preview = useMemo(() => {
    if (!model) return [];
    const config = { ...DEFAULT_PLANS, ...estimation };
    const priced = {
      ...model.pricing,
      input,
      output,
      creditsOverride: draft.credits.trim() === "" ? null : Number(draft.credits) || 0,
    };
    return config.tiers.map((tier) => ({
      tier,
      before: estimateMessages(config, model.pricing, tier.multiplier),
      after: estimateMessages(config, priced, tier.multiplier),
    }));
  }, [draft.credits, estimation, input, model, output]);

  if (!model) return null;

  const { pricing } = model;
  const image = pricing.unit === "image";
  const priceDirty = input !== pricing.input || output !== pricing.output;
  const creditsOverride = draft.credits.trim() === "" ? null : Number(draft.credits);
  const creditsInvalid =
    creditsOverride !== null && (!Number.isInteger(creditsOverride) || creditsOverride < 0);
  const dirty =
    priceDirty ||
    draft.free !== pricing.freeAccess ||
    creditsOverride !== (pricing.creditsOverride ?? null);
  const derivedCredits = creditsPerMessage(
    { ...DEFAULT_PLANS, ...estimation },
    { ...pricing, input, output, creditsOverride: null },
  );
  const credits = creditsInvalid ? derivedCredits : (creditsOverride ?? derivedCredits);
  const invalid =
    creditsInvalid ||
    (draft.input !== "" && input === null) ||
    (draft.output !== "" && output === null);

  async function submit() {
    if (!model || saving) return;
    if (priceDirty && (input === null || output === null)) {
      setError("请填写完整的输入、输出价格（0～1000000）");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(model, { input, output, freeAccess: draft.free, creditsOverride }, priceDirty);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "价格保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppDialog closeDisabled={saving} onClose={onClose} open title="编辑模型价格" width={560}>
      <form
        className="space-y-5 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-3">
          <ModelBrandIcon model={model.id} provider={model.provider} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{modelName(model)}</p>
            <p className="mt-0.5 truncate font-jakarta text-xs text-gray-400">
              {model.developer.name} · {model.id}
            </p>
          </div>
          <PriceStateBadge pricing={pricing} />
        </div>

        <fieldset>
          <legend className="mb-2 flex w-full items-center justify-between text-xs text-gray-500">
            <span>API 价格（{priceUnit(pricing)}）</span>
            {dirty && (
              <button
                className="inline-flex min-h-8 items-center gap-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() =>
                  setDraft({
                    credits: pricing.creditsOverride?.toString() ?? "",
                    free: pricing.freeAccess,
                    input: pricing.input?.toString() ?? "",
                    output: pricing.output?.toString() ?? "",
                  })
                }
                type="button"
              >
                <RotateCcw size={12} /> 还原
              </button>
            )}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {(["input", "output"] as const).map((field, index) => (
              <label className="block min-w-0" key={field}>
                <span className="mb-1.5 block text-sm font-medium">
                  {field === "input" ? "输入价格" : image ? "每张价格" : "输出价格"}
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {pricing.currency === "USD" ? "$" : "¥"}
                  </span>
                  <AppInput
                    aria-invalid={invalid}
                    autoComplete="off"
                    autoFocus={index === 0}
                    className="!h-11 !pl-7 font-jakarta tabular-nums md:!h-10"
                    disabled={saving}
                    inputMode="decimal"
                    onChange={(event) => {
                      setDraft({ ...draft, [field]: event.target.value });
                      setError("");
                    }}
                    placeholder="待补充"
                    value={draft[field]}
                  />
                </div>
                <span className="mt-1 block text-[11px] text-gray-400">
                  当前 {formatPrice(pricing, pricing[field])}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-sm font-medium">
            每次对话扣除 credits
            <span className="text-[11px] font-normal text-gray-400">
              留空按价格自动计算（当前 {formatAmount(derivedCredits)}）
            </span>
          </span>
          <div className="relative">
            <AppInput
              aria-invalid={creditsInvalid}
              autoComplete="off"
              className="!h-11 !pr-16 font-jakarta tabular-nums md:!h-10"
              disabled={saving}
              inputMode="numeric"
              onChange={(event) => {
                setDraft({ ...draft, credits: event.target.value.replace(/\D/g, "") });
                setError("");
              }}
              placeholder={derivedCredits === null ? "待补充价格" : `自动：${derivedCredits}`}
              value={draft.credits}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              credits
            </span>
          </div>
        </label>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-sm font-medium">对免费版开放</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              开放后免费用户可使用，消耗套餐管理中设置的每月共享次数
            </p>
          </div>
          <ToggleSwitch
            aria-label="对免费版开放"
            checked={draft.free}
            disabled={saving}
            onChange={(checked) => setDraft({ ...draft, free: checked })}
          />
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-xs dark:border-white/[0.06]">
            <span className="font-medium">每月可用{image ? "张数" : "消息数"}预估</span>
            <span className="text-gray-400">
              每{image ? "张" : "条"} {formatAmount(credits)} credits
            </span>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
            {preview.map(({ tier, before, after }) => (
              <li className="flex items-center justify-between px-3 py-2 text-sm" key={tier.id}>
                <span className="text-gray-600 dark:text-gray-300">
                  {PLAN_NAMES[tier.id]}
                  <span className="ml-1.5 text-[11px] text-gray-400">×{tier.multiplier}</span>
                </span>
                <span className="font-jakarta tabular-nums">
                  {dirty && before !== after && (
                    <span className="mr-2 text-xs text-gray-400 line-through">
                      {formatAmount(before)}
                    </span>
                  )}
                  <span className="font-medium">
                    {credits === 0 ? "不消耗" : formatAmount(after)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-gray-100 px-3 py-2 text-[11px] leading-5 text-gray-400 dark:border-white/[0.06]">
            按单次 {estimation.inputTokens.toLocaleString()} 输入 /{" "}
            {estimation.outputTokens.toLocaleString()} 输出 tokens 估算，所有模型共享套餐额度。
          </p>
        </div>

        {(pricing.source || pricing.note) && (
          <div className="text-xs leading-5 text-gray-500">
            {pricing.source && (
              <a
                className="inline-flex min-h-8 items-center gap-1 underline decoration-gray-300 underline-offset-4 hover:text-gray-900 dark:decoration-gray-600 dark:hover:text-white"
                href={pricing.source}
                rel="noopener noreferrer"
                target="_blank"
              >
                {pricing.basis === "cloud" ? "云平台报价来源" : "原厂报价来源"}
                <ExternalLink size={11} />
              </a>
            )}
            {pricing.note && <p className="text-gray-400">{pricing.note}</p>}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
          <AdminButton disabled={saving} onClick={onClose}>
            取消
          </AdminButton>
          <AdminButton disabled={!dirty || invalid} loading={saving} primary type="submit">
            保存价格
          </AdminButton>
        </div>
      </form>
    </AppDialog>
  );
}
