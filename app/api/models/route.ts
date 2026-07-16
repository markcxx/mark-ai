import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest, enforceRateLimit } from '@/lib/api/security';
import { getDb } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { getProviderDisplayName, getPublicConfiguredModels } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;

  const models = getPublicConfiguredModels();
  const providers = [...new Set(models.map((m) => m.provider))];
  const providerNames: Record<string, string> = {};
  for (const p of providers) {
    providerNames[p] = getProviderDisplayName(p);
  }

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

  return NextResponse.json({
    models,
    providerNames,
    selectedModel,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function PATCH(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;

  const limited = enforceRateLimit({
    key: authorization.key,
    limit: 60,
    scope: 'model-preference',
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const provider = typeof body?.provider === 'string' ? body.provider.trim() : '';
  const modelExists = getPublicConfiguredModels().some(
    (model) => model.id === id && model.provider === provider,
  );

  if (!id || !provider || !modelExists) {
    return NextResponse.json({ error: 'Model is not configured' }, { status: 400 });
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
