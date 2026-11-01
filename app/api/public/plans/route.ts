import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/security";
import { estimateMessages } from "@/lib/plans";
import { paymentAvailability } from "@/lib/server/payments";
import { readPlans } from "@/lib/server/plans";

export const dynamic = "force-dynamic";

/**
 * Public plan catalog for guests: prices, credits and example conversation
 * counts. Model prices, credit conversion and contact details stay admin-only.
 */
export async function GET(req: NextRequest) {
  const address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = enforceRateLimit({ key: `ip:${address}`, limit: 60, scope: "public-plans" });
  if (limited) return limited;
  try {
    const { config } = await readPlans();
    const featured = config.models.filter((model) => model.featured);
    return NextResponse.json(
      {
        freeMessages: config.freeMessages,
        freeModels: config.models.filter((model) => model.freeAccess).length,
        payment: { enabled: paymentAvailability().enabled },
        tiers: config.tiers.map((tier) => ({
          id: tier.id,
          price: tier.price,
          multiplier: tier.multiplier,
          credits: config.baseCredits * tier.multiplier,
          models: featured.map((model) => ({
            key: model.key,
            name: model.name,
            category: model.category,
            messages: estimateMessages(config, model, tier.multiplier),
          })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "套餐信息暂时无法加载" }, { status: 503 });
  }
}
