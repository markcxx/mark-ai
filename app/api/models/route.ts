import { NextResponse } from 'next/server';
import { getPublicConfiguredModels } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    models: getPublicConfiguredModels(),
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
