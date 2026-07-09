import { NextResponse } from 'next/server';

import {
  deleteChatSession,
  getChatMessages,
  getChatSession,
  updateChatSessionFavorite,
  updateChatSessionTitle,
} from '@/lib/chat/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const session = getChatSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      messages: getChatMessages(sessionId),
      session,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!getChatSession(sessionId)) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  deleteChatSession(sessionId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!getChatSession(sessionId)) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.favorite === 'boolean') {
    const session = updateChatSessionFavorite(sessionId, body.favorite);
    return NextResponse.json({ session });
  }

  const title = typeof body.title === 'string' ? body.title : '';
  const session = updateChatSessionTitle(sessionId, title);

  return NextResponse.json({ session });
}
