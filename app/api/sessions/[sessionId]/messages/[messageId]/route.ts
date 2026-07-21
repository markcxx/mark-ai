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
    { currentRevision: error.currentRevision, error: "会话已在其他位置更新，请刷新后重试" },
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
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (hasInvalidExpectedRevision(body?.revision)) {
      return NextResponse.json({ error: "会话版本号无效" }, { status: 400 });
    }
    const existingMessages = await getChatMessages(sessionId, userId);
    const existing = existingMessages.find(
      (message) => message.id === messageId || message.id === `${sessionId}:${messageId}`,
    );
    if (!existing) return NextResponse.json({ error: "消息不存在" }, { status: 404 });
    const message =
      body?.message && typeof body.message === "object"
        ? { ...existing, ...body.message, id: existing.id }
        : undefined;
    if (!isMessage(message)) {
      return NextResponse.json({ error: "消息内容格式无效" }, { status: 400 });
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
    return NextResponse.json({ error: "更新消息失败，请稍后重试" }, { status: 500 });
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
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }
    const revisionValue =
      req.nextUrl.searchParams.get("revision") || req.headers.get("if-match") || undefined;
    if (hasInvalidExpectedRevision(revisionValue)) {
      return NextResponse.json({ error: "会话版本号无效" }, { status: 400 });
    }
    const expectedRevision = parseExpectedRevision(revisionValue);
    const result = await deleteChatMessage(sessionId, messageId, userId, { expectedRevision });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChatRevisionConflictError) return revisionConflictResponse(error);
    console.error("Session message delete error:", error);
    return NextResponse.json({ error: "删除消息失败，请稍后重试" }, { status: 500 });
  }
}
