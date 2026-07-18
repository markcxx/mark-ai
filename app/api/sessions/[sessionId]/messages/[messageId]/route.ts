import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import {
  hasInvalidExpectedRevision,
  isMessage,
  parseExpectedRevision,
} from "@/lib/chat/message-validation";
import {
  deleteChatMessage,
  getChatMessages,
  getChatSession,
  upsertChatMessage,
} from "@/lib/chat/storage";
import { ChatRevisionConflictError } from "@/lib/chat/storage-adapter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const revisionConflictResponse = (error: ChatRevisionConflictError) =>
  NextResponse.json(
    { currentRevision: error.currentRevision, error: "Session revision conflict" },
    { status: 409 },
  );

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ messageId: string; sessionId: string }> },
) {
  try {
    const { messageId, sessionId } = await context.params;
    const userId = await getCurrentUserId();
    if (!(await getChatSession(sessionId, userId))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (hasInvalidExpectedRevision(body?.revision)) {
      return NextResponse.json({ error: "Invalid session revision" }, { status: 400 });
    }
    const existingMessages = await getChatMessages(sessionId, userId);
    const existing = existingMessages.find(
      (message) => message.id === messageId || message.id === `${sessionId}:${messageId}`,
    );
    if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    const message =
      body?.message && typeof body.message === "object"
        ? { ...existing, ...body.message, id: existing.id }
        : undefined;
    if (!isMessage(message)) {
      return NextResponse.json({ error: "Invalid message payload" }, { status: 400 });
    }
    const position =
      Number.isSafeInteger(body.position) && body.position >= 0 ? Number(body.position) : undefined;
    const result = await upsertChatMessage(sessionId, message, userId, {
      expectedRevision: parseExpectedRevision(body.revision),
      position,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChatRevisionConflictError) return revisionConflictResponse(error);
    console.error("Session message update error:", error);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string; sessionId: string }> },
) {
  try {
    const { messageId, sessionId } = await context.params;
    const userId = await getCurrentUserId();
    if (!(await getChatSession(sessionId, userId))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const revisionValue =
      req.nextUrl.searchParams.get("revision") || req.headers.get("if-match") || undefined;
    if (hasInvalidExpectedRevision(revisionValue)) {
      return NextResponse.json({ error: "Invalid session revision" }, { status: 400 });
    }
    const expectedRevision = parseExpectedRevision(revisionValue);
    const result = await deleteChatMessage(sessionId, messageId, userId, { expectedRevision });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChatRevisionConflictError) return revisionConflictResponse(error);
    console.error("Session message delete error:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
