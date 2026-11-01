import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { paymentAvailability } from "@/lib/server/payments";
import { readMembership, readPlans } from "@/lib/server/plans";
export const dynamic = "force-dynamic";
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const [{ config }, membership] = await Promise.all([readPlans(), readMembership(userId)]);
  // Procurement rates and source configuration are admin-only.
  const { estimateMessages } = await import("@/lib/plans");
  return NextResponse.json(
    {
      tiers: config.tiers.map((t) => ({
        ...t,
        credits: config.baseCredits * t.multiplier,
        models: config.models
          .filter((m) => m.featured)
          .map((m) => ({
            key: m.key,
            name: m.name,
            category: m.category ?? "flagship",
            priceStatus: m.status,
            messages: estimateMessages(config, m, t.multiplier),
          })),
      })),
      membership,
      contactEmail: config.contactEmail,
      inputTokens: config.inputTokens,
      outputTokens: config.outputTokens,
      payment: paymentAvailability(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
