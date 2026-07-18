import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import {
  deleteChatSession,
  getChatMessages,
  getChatSession,
  updateChatSessionFavorite,
  updateChatSessionTitle,
} from "@/lib/chat/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const userId = await getCurrentUserId();
  const session = await getChatSession(sessionId, userId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      messages: await getChatMessages(sessionId, userId),
      session,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        ETag: `"${session.revision}"`,
      },
    },
  );
}

export async function DELETE(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const userId = await getCurrentUserId();
  if (!(await getChatSession(sessionId, userId))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await deleteChatSession(sessionId, userId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const userId = await getCurrentUserId();
  if (!(await getChatSession(sessionId, userId))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.favorite === "boolean") {
    const session = await updateChatSessionFavorite(sessionId, body.favorite, userId);
    return NextResponse.json({ session });
  }

  const title = typeof body.title === "string" ? body.title : "";
  const session = await updateChatSessionTitle(sessionId, title, userId);

  return NextResponse.json({ session });
}
