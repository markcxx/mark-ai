import { NextRequest, NextResponse } from 'next/server';

import { createChatSession, listChatSessions } from '@/lib/chat/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    { sessions: listChatSessions() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const session = createChatSession({
    initialMessage: typeof body.initialMessage === 'string' ? body.initialMessage : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
    provider: typeof body.provider === 'string' ? body.provider : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
  });

  return NextResponse.json({ session }, { status: 201 });
}

