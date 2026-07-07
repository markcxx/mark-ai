import { NextResponse } from 'next/server';
import { getConfiguredModels } from '@/lib/models';

export async function GET() {
  return NextResponse.json({
    models: getConfiguredModels(),
  });
}
