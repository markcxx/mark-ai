import "server-only";
import { officialPlanPrice } from "./plan-prices";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { membershipPlans, userMemberships } from "@/lib/db/schema";
import { DEFAULT_PLANS, type PlanModel } from "@/lib/plans";
import { getPublicConfiguredModels } from "@/lib/models";
import { withModelCatalog } from "@/lib/server/model-catalog";
import { getModelKey } from "@/lib/chat/helpers";
import { readAnnouncement } from "@/lib/announcement";
export async function readPlans() {
  const [row] = await getDb()
    .select()
    .from(membershipPlans)
    .where(eq(membershipPlans.id, "current"));
  const models = await withModelCatalog(getPublicConfiguredModels());
  const notice = await readAnnouncement("registration");
  const existing = row?.config;
  const defaults: PlanModel[] = models.map((m) => {
    const p = officialPlanPrice(m.id);
    return {
      ...p,
      key: getModelKey(m),
      name: m.metadata?.displayName || m.id,
      featured: p.unit === "mtok" && p.input !== null && p.output !== null,
      category: /flash|haiku|luna|(?:^|[-_.])mini(?:[-_.]|$)|lite|minimax/i.test(m.id)
        ? "everyday"
        : "flagship",
      freeAccess: false,
    };
  });
  defaults.sort((a, b) => Number(b.featured) - Number(a.featured));
  return {
    revision: row?.revision ?? "",
    config: {
      ...DEFAULT_PLANS,
      // Saved credit settings survive; older rows fall back to the defaults.
      // The reference token profile is internal and always uses the built-in
      // default, so stale values saved by older versions cannot skew pricing.
      ...(existing && {
        baseCredits: existing.baseCredits ?? DEFAULT_PLANS.baseCredits,
        creditsPerYuan: existing.creditsPerYuan ?? DEFAULT_PLANS.creditsPerYuan,
        freeMessages: existing.freeMessages ?? DEFAULT_PLANS.freeMessages,
        usdRate: existing.usdRate ?? DEFAULT_PLANS.usdRate,
      }),
      contactEmail:
        existing?.contactEmail ??
        (notice.actionUrl.startsWith("mailto:") ? notice.actionUrl.slice(7) : ""),
      models: defaults.map((m) => {
        const saved = existing?.models.find((s) => s.key === m.key);
        // Old manual message quotas are intentionally discarded. Only explicit price overrides survive.
        const override = saved?.priceOverride;
        const compatible =
          override &&
          override.currency === m.currency &&
          override.unit === m.unit &&
          typeof override.input === "number" &&
          Number.isFinite(override.input) &&
          override.input >= 0 &&
          typeof override.output === "number" &&
          Number.isFinite(override.output) &&
          override.output >= 0;
        // Free access is an admin decision. New everyday models start open to
        // free accounts; earlier per-model counts map to "open" when non-zero.
        const legacy = (saved as { freeMessages?: number } | undefined)?.freeMessages;
        const freeAccess =
          typeof saved?.freeAccess === "boolean"
            ? saved.freeAccess
            : typeof legacy === "number"
              ? legacy > 0
              : m.category === "everyday";
        const creditsOverride =
          typeof saved?.creditsOverride === "number" ? saved.creditsOverride : null;
        return compatible
          ? {
              ...m,
              creditsOverride,
              freeAccess,
              input: override.input,
              output: override.output,
              priceOverride: override,
            }
          : { ...m, creditsOverride, freeAccess, priceOverride: null };
      }),
      tiers: (existing?.tiers ?? DEFAULT_PLANS.tiers).map((t) => ({
        ...t,
        name: DEFAULT_PLANS.tiers.find((d) => d.id === t.id)!.name,
      })),
    },
  };
}
export async function readMembership(userId: string) {
  const [row] = await getDb()
    .select()
    .from(userMemberships)
    .where(eq(userMemberships.userId, userId));
  return {
    tier: row && (!row.expiresAt || row.expiresAt > new Date()) ? row.tier : "free",
    expiresAt: row?.expiresAt?.toISOString() ?? null,
  };
}

const MONTH_MS = 30 * 86_400_000;

export type CreditModel = {
  key: string;
  perMessage: number | null;
  freeAccess: boolean;
};
export type CreditSummary = {
  tier: string;
  unlimited: boolean;
  /** Paid tiers: credit pool. Free tier: shared conversation allowance. */
  total: number;
  used: number;
  remaining: number;
  unit: "credits" | "messages";
  periodStart: string;
  periodEnd: string;
  models: CreditModel[];
};

function currentPeriod(membership: { expiresAt: string | null }, paid: boolean) {
  const now = Date.now();
  const expires = membership.expiresAt ? Date.parse(membership.expiresAt) : NaN;
  if (paid && Number.isFinite(expires)) {
    let start = expires - MONTH_MS;
    while (start > now) start -= MONTH_MS;
    return { start, end: Math.min(expires, start + MONTH_MS) };
  }
  const date = new Date(now);
  return {
    start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    end: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  };
}

/**
 * Current-period balance from the usage ledger. Paid tiers share a credit pool
 * over the 30 days ending at their expiry; free accounts share one monthly
 * conversation allowance across every model marked free. Lifetime: unlimited.
 */
export async function readCreditSummary(userId: string): Promise<CreditSummary> {
  const { and, gte, lt, sum, count } = await import("drizzle-orm");
  const { creditsPerMessage } = await import("@/lib/plans");
  const { modelUsageEvents } = await import("@/lib/db/schema");
  const [{ config }, membership] = await Promise.all([readPlans(), readMembership(userId)]);
  const tier = config.tiers.find((item) => item.id === membership.tier);
  const unlimited = membership.tier === "lifetime";
  const { start, end } = currentPeriod(membership, Boolean(tier));

  let used = 0;
  if (!unlimited) {
    const [row] = await getDb()
      .select({ credits: sum(modelUsageEvents.credits), calls: count() })
      .from(modelUsageEvents)
      .where(
        and(
          eq(modelUsageEvents.userId, userId),
          eq(modelUsageEvents.free, tier ? 0 : 1),
          gte(modelUsageEvents.createdAt, new Date(start)),
          lt(modelUsageEvents.createdAt, new Date(end)),
        ),
      );
    used = tier ? Number(row?.credits ?? 0) : Number(row?.calls ?? 0);
  }
  const total = tier ? config.baseCredits * tier.multiplier : unlimited ? 0 : config.freeMessages;
  return {
    tier: membership.tier,
    unlimited,
    total,
    used,
    remaining: Math.max(0, total - used),
    unit: tier || unlimited ? "credits" : "messages",
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(end).toISOString(),
    models: config.models.map((model) => ({
      key: model.key,
      perMessage: creditsPerMessage(config, model),
      freeAccess: model.freeAccess,
    })),
  };
}

/**
 * Chat gate. Returns a Chinese, actionable message when the user may not send
 * with this model, or null when allowed. Models on the user's own API key
 * never reach here.
 */
export async function checkChatAllowance(userId: string, modelKey: string) {
  const summary = await readCreditSummary(userId);
  if (summary.unlimited) return null;
  const model = summary.models.find((item) => item.key === modelKey);
  if (summary.tier === "free") {
    if (!model?.freeAccess) return "该模型为会员专享，升级套餐后即可使用";
    if (summary.remaining <= 0)
      return `本月 ${summary.total} 次免费对话已用完，升级套餐即可继续使用`;
    return null;
  }
  const cost = model?.perMessage ?? 0;
  if (summary.remaining <= 0 || summary.remaining < cost)
    return "本期套餐额度不足，可续费或升级套餐";
  return null;
}

/**
 * Records one billable call: every request that reached the provider
 * successfully, including retries and regenerations. Lifetime members are
 * logged with zero credits so usage stays auditable.
 */
export async function recordModelUsage(userId: string, modelKey: string) {
  const { randomUUID } = await import("node:crypto");
  const { creditsPerMessage } = await import("@/lib/plans");
  const { modelUsageEvents } = await import("@/lib/db/schema");
  const [{ config }, membership] = await Promise.all([readPlans(), readMembership(userId)]);
  const tier = config.tiers.find((item) => item.id === membership.tier);
  const model = config.models.find((item) => item.key === modelKey);
  const paid = Boolean(tier);
  const lifetime = membership.tier === "lifetime";
  await getDb()
    .insert(modelUsageEvents)
    .values({
      id: randomUUID(),
      userId,
      modelKey,
      tier: membership.tier,
      credits: paid && model ? (creditsPerMessage(config, model) ?? 0) : 0,
      free: paid || lifetime ? 0 : 1,
    });
}
