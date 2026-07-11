import { NextResponse } from 'next/server';
import { getProviderDisplayName, getPublicConfiguredModels } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
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
