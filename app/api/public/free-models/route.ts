import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api/security";
import { readPlans } from "@/lib/server/plans";

export const dynamic = "force-dynamic";

/** Which site models the free tier may use, for guests' Pro labels. No prices. */
export async function GET(req: NextRequest) {
  const address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = enforceRateLimit({ key: `ip:${address}`, limit: 60, scope: "public-free" });
  if (limited) return limited;
  try {
    const { config } = await readPlans();
    return NextResponse.json(
      {
        freeMessages: config.freeMessages,
        models: config.models.filter((model) => model.freeAccess).map((model) => model.key),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ models: [] });
  }
}
