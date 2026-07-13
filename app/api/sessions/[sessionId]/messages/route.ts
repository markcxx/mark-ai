import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth-helpers';
import { getChatSession, replaceChatMessages } from '@/lib/chat/storage';
import type { Message } from '@/lib/chat/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_MESSAGE_COUNT = 500;
const MAX_MESSAGE_CONTENT_CHARS = 200_000;
const MAX_MESSAGES_JSON_CHARS = 4_000_000;

const isMessage = (value: unknown): value is Message => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<Message>;
  return (
    typeof message.id === 'string' &&
    message.id.length > 0 &&
    message.id.length <= 256 &&
    typeof message.content === 'string' &&
    message.content.length <= MAX_MESSAGE_CONTENT_CHARS &&
    (message.role === 'user' || message.role === 'model')
  );
};

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    const userId = await getCurrentUserId();
    if (!(await getChatSession(sessionId, userId))) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const contentLength = Number(req.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_MESSAGES_JSON_CHARS) {
      return NextResponse.json({ error: 'Message payload is too large' }, { status: 413 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Messages must be an array' }, { status: 400 });
    }
    if (body.messages.length > MAX_MESSAGE_COUNT) {
      return NextResponse.json({ error: 'Too many messages' }, { status: 413 });
    }
    if (!body.messages.every(isMessage)) {
      return NextResponse.json({ error: 'Invalid message payload' }, { status: 400 });
    }
    if (JSON.stringify(body.messages).length > MAX_MESSAGES_JSON_CHARS) {
      return NextResponse.json({ error: 'Message payload is too large' }, { status: 413 });
    }

    const messages: Message[] = body.messages;
    const result = await replaceChatMessages(sessionId, messages, userId);

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
