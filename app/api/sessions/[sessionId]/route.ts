import { NextResponse } from "next/server";

import { getCurrentUserId, LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";
import {
  deleteChatSession,
  findReferencedChatFileIds,
  getChatMessages,
  getChatSession,
  updateChatSessionFavorite,
  updateChatSessionTitle,
} from "@/lib/chat/storage";
import { collectMessageFileIds } from "@/lib/chat/message-file-references";
import { deleteStoredFile, getStoredFilesByIds } from "@/lib/storage/file-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const userId = await getCurrentUserId();
  const session = await getChatSession(sessionId, userId);

  if (!session) {
    return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
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
    return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
  }

  try {
    const storageOwnerId = userId || LOCAL_STORAGE_OWNER_ID;
    const messages = await getChatMessages(sessionId, userId);
    const candidateFileIds = [...collectMessageFileIds(messages)];
    const referencedElsewhere = await findReferencedChatFileIds(
      candidateFileIds,
      sessionId,
      userId,
    );
    const exclusiveFileIds = candidateFileIds.filter((fileId) => !referencedElsewhere.has(fileId));
    const files = (await getStoredFilesByIds(exclusiveFileIds, storageOwnerId)).filter(
      (file) => file.kind === "attachment",
    );

    for (const file of files) await deleteStoredFile(file);
    await deleteChatSession(sessionId, userId);
    return NextResponse.json({ deletedFileCount: files.length, ok: true });
  } catch (error) {
    console.error("Session file cleanup error:", error);
    return NextResponse.json(
      { error: "会话文件清理失败，请稍后重试删除" },
      { status: 502 },
    );
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const userId = await getCurrentUserId();
  if (!(await getChatSession(sessionId, userId))) {
    return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
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
