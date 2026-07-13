import { NextRequest, NextResponse } from 'next/server';
import { authorizeApiRequest } from '@/lib/api/security';
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

  return NextResponse.json({
    models,
    providerNames,
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
