import { NextRequest, NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/api/security";
import { getAvailableProviderNames, getAvailablePublicModels } from "@/lib/available-models";
import { readModelPresentations } from "@/lib/model-presentation-server";
import { withModelPresentations } from "@/lib/model-presentation";
import { withModelCatalog } from "@/lib/server/model-catalog";

export const dynamic = "force-dynamic";

/** Read-only site model catalog for anonymous visitors. Contains no credentials. */
export async function GET(req: NextRequest) {
  const address =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "local";
  const limited = enforceRateLimit({ key: `ip:${address}`, limit: 60, scope: "public-models" });
  if (limited) return limited;

  const [models, providerNames] = await Promise.all([
    getAvailablePublicModels(),
    getAvailableProviderNames(),
  ]);

  let presentedModels = models;
  try {
    presentedModels = withModelPresentations(models, await readModelPresentations(), new Set());
  } catch (error) {
    console.error("Model presentation unavailable:", error);
  }

  return NextResponse.json(
    { models: await withModelCatalog(presentedModels), providerNames },
    { headers: { "Cache-Control": "no-store" } },
  );
}
