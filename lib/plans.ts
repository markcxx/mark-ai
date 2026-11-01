export const PLAN_IDS = ["free", "starter", "plus", "pro", "lifetime"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const PLAN_NAMES: Record<PlanId, string> = {
  free: "免费版",
  lifetime: "永久会员",
  starter: "基础版",
  plus: "进阶版",
  pro: "专业版",
};
export type ModelPrice = {
  input: number | null;
  output: number | null;
  currency: "CNY" | "USD";
  unit: "mtok" | "image";
  source: string;
  basis: "manufacturer" | "cloud";
  note: string;
  checkedAt: string;
  status: "verified" | "historical" | "retired" | "estimated" | "unverified";
};
export type PlanModel = ModelPrice & {
  key: string;
  name: string;
  category: "flagship" | "everyday";
  featured: boolean;
  priceOverride?: Pick<ModelPrice, "input" | "output" | "currency" | "unit"> | null;
  /** Free accounts may use this model, drawing on the shared monthly allowance. */
  freeAccess: boolean;
  /** Admin override for credits charged per reply; null = derived from price. */
  creditsOverride?: number | null;
};

export const MAX_FREE_MESSAGES = 100_000;
export const isFreeModel = (model: Pick<PlanModel, "freeAccess">) => model.freeAccess;
export type PlanConfig = {
  /** Monthly credits of the base tier; other tiers multiply it. */
  baseCredits: number;
  /** Credits per ¥1 of model cost. */
  creditsPerYuan: number;
  /** Conversations per month a free account shares across all free models. */
  freeMessages: number;
  /**
   * Typical token size of one reply. Internal: only used to turn a per-token
   * price into a per-reply credit price; not an admin setting.
   */
  inputTokens: number;
  outputTokens: number;
  usdRate: number;
  contactEmail: string;
  tiers: {
    id: Exclude<PlanId, "free" | "lifetime">;
    name: string;
    price: number;
    multiplier: number;
  }[];
  models: PlanModel[];
};
// Defaults only; admin-facing values are edited in 套餐管理 and stored in the
// database. ¥1 of model cost = 100 credits, so the base tier's 2,000 credits ≈ ¥20.
export const DEFAULT_PLANS: PlanConfig = {
  baseCredits: 2000,
  creditsPerYuan: 100,
  freeMessages: 30,
  inputTokens: 8000,
  outputTokens: 1500,
  usdRate: 7.2,
  contactEmail: "",
  tiers: [
    { id: "starter", name: "基础版", price: 39, multiplier: 1 },
    { id: "plus", name: "进阶版", price: 99, multiplier: 3 },
    { id: "pro", name: "专业版", price: 199, multiplier: 7 },
  ],
  models: [],
};
/** Model cost in CNY of one reference conversation, or null without a price. */
export function conversationCost(config: PlanConfig, model: PlanModel) {
  if (model.input === null || model.output === null) return null;
  const rate = model.currency === "USD" ? config.usdRate : 1;
  if (model.unit === "image") return model.output * rate;
  return ((config.inputTokens * model.input + config.outputTokens * model.output) / 1e6) * rate;
}

/**
 * Credits charged for one reply. This is the single source for display and
 * billing: an admin override wins, otherwise price-derived and rounded up so
 * any paid model costs at least one credit.
 */
export function creditsPerMessage(config: PlanConfig, model: PlanModel): number | null {
  if (typeof model.creditsOverride === "number") return model.creditsOverride;
  const cost = conversationCost(config, model);
  if (cost === null) return null;
  return cost === 0 ? 0 : Math.max(1, Math.ceil(cost * config.creditsPerYuan));
}

/** Monthly conversations a tier allows with one model (credits shared across models). */
export function estimateMessages(config: PlanConfig, model: PlanModel, multiplier: number) {
  const credits = creditsPerMessage(config, model);
  return credits !== null && credits > 0
    ? Math.floor((config.baseCredits * multiplier) / credits)
    : null;
}

export function parsePlans(value: unknown): PlanConfig | null {
  const c = value as PlanConfig;
  const number = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const price = (n: unknown) => n === null || number(n, 0, 1000000);
  const settings = {
    baseCredits: c?.baseCredits ?? DEFAULT_PLANS.baseCredits,
    creditsPerYuan: c?.creditsPerYuan ?? DEFAULT_PLANS.creditsPerYuan,
    freeMessages: c?.freeMessages ?? DEFAULT_PLANS.freeMessages,
    inputTokens: DEFAULT_PLANS.inputTokens,
    outputTokens: DEFAULT_PLANS.outputTokens,
    usdRate: c?.usdRate ?? DEFAULT_PLANS.usdRate,
  };
  if (
    !number(settings.baseCredits, 1, 1e9) ||
    !Number.isInteger(settings.baseCredits) ||
    !number(settings.creditsPerYuan, 0.01, 1e9) ||
    !Number.isInteger(settings.freeMessages) ||
    !number(settings.freeMessages, 0, MAX_FREE_MESSAGES) ||
    !number(settings.inputTokens, 0, 10_000_000) ||
    !number(settings.outputTokens, 1, 10_000_000) ||
    !number(settings.usdRate, 0.01, 1000)
  )
    return null;
  if (
    !c ||
    typeof c.contactEmail !== "string" ||
    c.contactEmail.length > 254 ||
    (c.contactEmail && !/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(c.contactEmail))
  )
    return null;
  if (
    !Array.isArray(c.tiers) ||
    c.tiers.length !== 3 ||
    c.tiers.some(
      (t, i) =>
        !t ||
        t.id !== PLAN_IDS[i + 1] ||
        !number(t.price, 0.01, 100000) ||
        !number(t.multiplier, 1, 1000),
    ) ||
    c.tiers[0].multiplier !== 1 ||
    c.tiers[1].multiplier <= 1 ||
    c.tiers[2].multiplier <= c.tiers[1].multiplier
  )
    return null;
  if (
    !Array.isArray(c.models) ||
    c.models.length > 2000 ||
    c.models.some(
      (m) =>
        !m ||
        typeof m.key !== "string" ||
        m.key.length > 500 ||
        typeof m.name !== "string" ||
        m.name.length > 200 ||
        !["manufacturer", "cloud"].includes(m.basis) ||
        typeof m.source !== "string" ||
        m.source.length > 1000 ||
        typeof m.note !== "string" ||
        m.note.length > 2000 ||
        typeof m.checkedAt !== "string" ||
        typeof m.featured !== "boolean" ||
        !["CNY", "USD"].includes(m.currency) ||
        !["mtok", "image"].includes(m.unit) ||
        !["flagship", "everyday"].includes(m.category) ||
        !["verified", "historical", "retired", "estimated", "unverified"].includes(m.status) ||
        !price(m.input) ||
        !price(m.output) ||
        (m.creditsOverride != null &&
          (!Number.isInteger(m.creditsOverride) || !number(m.creditsOverride, 0, 1e9))) ||
        (m.freeAccess !== undefined && typeof m.freeAccess !== "boolean") ||
        (m.priceOverride != null &&
          (!number(m.priceOverride.input, 0, 1000000) ||
            !number(m.priceOverride.output, 0, 1000000) ||
            m.priceOverride.currency !== m.currency ||
            m.priceOverride.unit !== m.unit)),
    ) ||
    new Set(c.models.map((m) => m.key)).size !== c.models.length
  )
    return null;
  return {
    ...DEFAULT_PLANS,
    ...settings,
    contactEmail: c.contactEmail,
    tiers: c.tiers.map(({ id, price, multiplier }) => ({
      id,
      name: PLAN_NAMES[id],
      price,
      multiplier,
    })),
    models: c.models.map(
      ({
        key,
        name,
        input,
        output,
        currency,
        unit,
        source,
        basis,
        note,
        checkedAt,
        status,
        featured,
        category,
        priceOverride,
        freeAccess,
        creditsOverride,
      }) => ({
        key,
        name,
        input,
        output,
        currency,
        unit,
        source,
        basis,
        note,
        checkedAt,
        status,
        featured,
        category,
        priceOverride: priceOverride
          ? { input: priceOverride.input, output: priceOverride.output, currency, unit }
          : null,
        freeAccess: freeAccess ?? false,
        creditsOverride: creditsOverride ?? null,
      }),
    ),
  };
}
