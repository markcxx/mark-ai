import { NextRequest, NextResponse } from 'next/server';
import { readWebpage } from '@/lib/search/webpage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const data = await readWebpage({ signal: req.signal, url });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Read aborted' }, { status: 499 });
    }

    const message = error instanceof Error ? error.message : 'Failed to read webpage';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
