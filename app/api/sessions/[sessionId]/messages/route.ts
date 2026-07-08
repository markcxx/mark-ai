import { NextRequest, NextResponse } from 'next/server';

import { getChatSession, replaceChatMessages } from '@/lib/chat/storage';
import type { Message } from '@/lib/chat/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<Message>;
  return (
    typeof message.id === 'string' &&
    typeof message.content === 'string' &&
    (message.role === 'user' || message.role === 'model')
  );
};

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    if (!getChatSession(sessionId)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages.filter(isMessage) : [];
    const result = replaceChatMessages(sessionId, messages);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Session messages save error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save session messages',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
