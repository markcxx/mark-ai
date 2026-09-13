import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { getAvailableProviderNames, getAvailablePublicModels } from "@/lib/available-models";
import { getDb } from "@/lib/db";
import { readModelPresentations } from "@/lib/model-presentation-server";
import { withModelPresentations } from "@/lib/model-presentation";
import { listUserModelProviders } from "@/lib/user-model-providers";
import { userSettings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;

  const [models, providerNames] = await Promise.all([
    getAvailablePublicModels(authorization.userId),
    getAvailableProviderNames(authorization.userId),
  ]);

  let selectedModel: { id: string; provider: string } | undefined;
  if (authorization.userId) {
    const [settings] = await getDb()
      .select({
        id: userSettings.defaultModel,
        provider: userSettings.defaultProvider,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, authorization.userId))
      .limit(1);

    if (
      settings?.id &&
      settings.provider &&
      models.some((model) => model.id === settings.id && model.provider === settings.provider)
    ) {
      selectedModel = { id: settings.id, provider: settings.provider };
    }
  }

  // Optional display metadata must never prevent access to configured models.
  let presentedModels = models;
  try {
    const [entries, providers] = await Promise.all([
      readModelPresentations(),
      authorization.userId ? listUserModelProviders(authorization.userId) : [],
    ]);
    presentedModels = withModelPresentations(
      models,
      entries,
      new Set(
        providers
          .filter(
            (provider) => provider.enabled && provider.hasApiKey && provider.models.length > 0,
          )
          .map((provider) => provider.provider),
      ),
    );
  } catch (error) {
    console.error("Model presentation unavailable:", error);
  }

  return NextResponse.json(
    {
      models: presentedModels,
      providerNames,
      selectedModel,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function PATCH(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;

  const limited = enforceRateLimit({
    key: authorization.key,
    limit: 60,
    scope: "model-preference",
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const provider = typeof body?.provider === "string" ? body.provider.trim() : "";
  const modelExists = (await getAvailablePublicModels(authorization.userId)).some(
    (model) => model.id === id && model.provider === provider,
  );

  if (!id || !provider || !modelExists) {
    return NextResponse.json({ error: "所选模型尚未配置或不可用" }, { status: 400 });
  }

  if (authorization.userId) {
    await getDb()
      .insert(userSettings)
      .values({
        defaultModel: id,
        defaultProvider: provider,
        id: `settings-${authorization.userId}`,
        userId: authorization.userId,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          defaultModel: id,
          defaultProvider: provider,
          updatedAt: new Date(),
        },
      });
  }

  return NextResponse.json({ ok: true });
}
