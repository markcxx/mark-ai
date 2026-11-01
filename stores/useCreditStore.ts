import { create } from "zustand";

import { isGuestMode } from "@/lib/client/guest-mode";

export type CreditSummary = {
  tier: string;
  unlimited: boolean;
  total: number;
  used: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  unit: "credits" | "messages";
  models: { key: string; perMessage: number | null; freeAccess: boolean }[];
};

type CreditStore = {
  summary: CreditSummary | null;
  loadedAt: number;
  /** Refreshes at most every 30s unless forced; guests never call the API. */
  load: (force?: boolean) => Promise<void>;
};

let inflight: Promise<void> | null = null;

export const useCreditStore = create<CreditStore>((set, get) => ({
  summary: null,
  loadedAt: 0,
  load: async (force = false) => {
    if (!force && Date.now() - get().loadedAt < 30_000) return;
    if (inflight) return inflight;
    // Guests may not call protected APIs; they only learn which models are free.
    inflight = (
      isGuestMode()
        ? loadGuestSummary()
        : fetch("/api/credits", { cache: "no-store" }).then((response) =>
            response.ok ? response.json() : null,
          )
    )
      .then((summary: CreditSummary | null) => {
        if (summary) set({ summary, loadedAt: Date.now() });
      })
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
}));

const loadGuestSummary = async (): Promise<CreditSummary | null> => {
  const response = await fetch("/api/public/free-models", { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as { freeMessages: number; models: string[] };
  return {
    tier: "free",
    unlimited: false,
    total: data.freeMessages,
    used: 0,
    remaining: data.freeMessages,
    unit: "messages",
    periodStart: "",
    periodEnd: "",
    models: data.models.map((key) => ({ key, perMessage: null, freeAccess: true })),
  };
};

/** Free accounts see a Pro label on models outside their allowance. */
export const isProOnly = (summary: CreditSummary | null, key: string) =>
  summary?.tier === "free" && !summary.models.find((model) => model.key === key)?.freeAccess;

export const perMessageCredits = (summary: CreditSummary | null, key: string) =>
  summary?.models.find((model) => model.key === key)?.perMessage ?? null;

export const formatCredits = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString("zh-CN", { maximumFractionDigits: 1 })}M`
    : value >= 10_000
      ? `${(value / 1_000).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}K`
      : value.toLocaleString("zh-CN");
