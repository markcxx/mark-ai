"use client";

import { Crown, Gem, Infinity as InfinityIcon, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PLAN_NAMES, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

// Escalating treatment: neutral free, tinted paid tiers, and a gold shimmer
// for lifetime. Colors stay small so the badge never competes with content.
const BADGES: Record<PlanId, { icon?: LucideIcon; className: string }> = {
  free: {
    className:
      "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:ring-white/10",
  },
  starter: {
    icon: Sparkles,
    className:
      "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
  },
  plus: {
    icon: Zap,
    className:
      "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25",
  },
  pro: {
    icon: Gem,
    className:
      "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-[0_1px_6px_rgba(139,92,246,0.35)]",
  },
  lifetime: {
    icon: Crown,
    className:
      "markai-badge-shimmer bg-[linear-gradient(110deg,#b8860b,#f5d76e_45%,#fff3c4_50%,#f5d76e_55%,#b8860b)] bg-[length:220%_100%] text-[#3d2b00] shadow-[0_1px_8px_rgba(212,160,23,0.45)]",
  },
};

export function MembershipBadge({
  tier,
  className,
}: {
  tier: PlanId | string;
  className?: string;
}) {
  const key = (tier in BADGES ? tier : "free") as PlanId;
  const { icon: Icon, className: tone } = BADGES[key];
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 text-[10px] font-semibold leading-none",
        tone,
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" size={10} strokeWidth={2.4} />}
      {PLAN_NAMES[key]}
    </span>
  );
}

/** Remaining credits as a filled bar; lifetime shows an unlimited state. */
export function CreditMeter({
  unlimited,
  total,
  remaining,
  periodEnd,
  unit = "credits",
}: {
  unlimited: boolean;
  total: number;
  remaining: number;
  periodEnd?: string;
  unit?: "credits" | "messages";
}) {
  if (unlimited)
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <InfinityIcon size={14} />
        不限额度，随心使用
      </div>
    );
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  // Theme color while healthy; only a nearly empty balance turns red.
  const tone = ratio <= 0.1 ? "bg-red-500" : "bg-primary";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-gray-500 dark:text-gray-400">
          {unit === "messages" ? "本月免费对话" : "剩余 credits"}
        </span>
        <span className="font-jakarta tabular-nums text-gray-700 dark:text-gray-200">
          {remaining.toLocaleString("zh-CN")}
          <span className="text-gray-400">
            {" "}
            / {total.toLocaleString("zh-CN")}
            {unit === "messages" ? " 次" : ""}
          </span>
        </span>
      </div>
      <div
        aria-label={`剩余额度 ${Math.round(ratio * 100)}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(ratio * 100)}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15"
        role="progressbar"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tone)}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {periodEnd && (
        <p className="mt-1 text-[10px] text-gray-400">
          {new Date(periodEnd).toLocaleDateString("zh-CN")} 重置
        </p>
      )}
    </div>
  );
}
