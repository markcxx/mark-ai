import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth-helpers';
import { createChatSession, listChatSessions } from '@/lib/chat/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const userId = await getCurrentUserId();
  const sessions = await listChatSessions(userId);

  return NextResponse.json(
    { sessions },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  const session = await createChatSession({
    initialMessage: typeof body.initialMessage === 'string' ? body.initialMessage : undefined,
    model: typeof body.model === 'string' ? body.model : undefined,
    provider: typeof body.provider === 'string' ? body.provider : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    userId,
  });

  return NextResponse.json({ session }, { status: 201 });
}
