import { NextRequest, NextResponse } from 'next/server';

import { getChatSession, updateChatSessionTitle } from '@/lib/chat/storage';
import { generateConversationTitle } from '@/lib/chat/title';
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const currentSession = getChatSession(sessionId);
  if (!currentSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages.filter(isMessage) : [];
  const result = await generateConversationTitle(messages, currentSession.title);
  const session = updateChatSessionTitle(sessionId, result.title);

  return NextResponse.json({ session, title: result.title, titleModel: result.titleModel });
}
