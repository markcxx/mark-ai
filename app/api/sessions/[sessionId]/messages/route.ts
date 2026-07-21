import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import {
  hasInvalidExpectedRevision,
  isMessage,
  parseExpectedRevision,
} from "@/lib/chat/message-validation";
import { getChatSession, replaceChatMessages, upsertChatMessage } from "@/lib/chat/storage";
import { ChatRevisionConflictError } from "@/lib/chat/storage-adapter";
import type { Message } from "@/lib/chat/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MESSAGE_COUNT = 500;
const MAX_MESSAGES_JSON_CHARS = 4_000_000;

const revisionConflictResponse = (error: ChatRevisionConflictError) =>
  NextResponse.json(
    { currentRevision: error.currentRevision, error: "会话已在其他位置更新，请刷新后重试" },
    { status: 409 },
  );

export async function PUT(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const userId = await getCurrentUserId();
    if (!(await getChatSession(sessionId, userId))) {
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }

    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MESSAGES_JSON_CHARS) {
      return NextResponse.json({ error: "消息内容过大，请缩短后重试" }, { status: 413 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "消息列表格式无效" }, { status: 400 });
    }
    if (hasInvalidExpectedRevision(body.revision)) {
      return NextResponse.json({ error: "会话版本号无效" }, { status: 400 });
    }
    if (body.messages.length > MAX_MESSAGE_COUNT) {
      return NextResponse.json({ error: "单个会话的消息数量过多" }, { status: 413 });
    }
    if (!body.messages.every(isMessage)) {
      return NextResponse.json({ error: "消息内容格式无效" }, { status: 400 });
    }
    if (JSON.stringify(body.messages).length > MAX_MESSAGES_JSON_CHARS) {
      return NextResponse.json({ error: "消息内容过大，请缩短后重试" }, { status: 413 });
    }

    const messages: Message[] = body.messages;
    const result = await replaceChatMessages(sessionId, messages, userId, {
      expectedRevision: parseExpectedRevision(body.revision),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChatRevisionConflictError) return revisionConflictResponse(error);
    console.error("Session messages save error:", error);
    return NextResponse.json(
      {
        error: "保存会话消息失败，请稍后重试",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const userId = await getCurrentUserId();
    if (!(await getChatSession(sessionId, userId))) {
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !isMessage(body.message)) {
      return NextResponse.json({ error: "消息内容格式无效" }, { status: 400 });
    }
    if (hasInvalidExpectedRevision(body.revision)) {
      return NextResponse.json({ error: "会话版本号无效" }, { status: 400 });
    }
    const position =
      Number.isSafeInteger(body.position) && body.position >= 0 ? Number(body.position) : undefined;
    const result = await upsertChatMessage(sessionId, body.message, userId, {
      expectedRevision: parseExpectedRevision(body.revision),
      position,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ChatRevisionConflictError) return revisionConflictResponse(error);
    console.error("Session message create error:", error);
    return NextResponse.json({ error: "保存新消息失败，请稍后重试" }, { status: 500 });
  }
}
