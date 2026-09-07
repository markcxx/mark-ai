import { NextResponse } from "next/server";
import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import { getChatMessages, getChatSession } from "@/lib/chat/storage";
import {
  getSessionShare,
  revokeSessionShare,
  saveConversationShare,
} from "@/lib/chat/share-storage";
import { isShareDuration, toReadonlyMessages } from "@/lib/chat/share-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ sessionId: string }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function authorize(context: Context) {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return { response: json({ error: "请先登录" }, 401) };
  const { sessionId } = await context.params;
  const session = await getChatSession(sessionId, userId);
  if (!session) return { response: json({ error: "会话不存在或无权访问" }, 404) };
  return { userId, sessionId, session };
}
const describe = (share: { token: string; expiresAt: Date; createdAt: Date }) => ({
  path: `/share/${share.token}`,
  expiresAt: share.expiresAt.toISOString(),
  createdAt: share.createdAt.toISOString(),
});
async function getShare(_request: Request, context: Context) {
  const auth = await authorize(context);
  if (auth.response) return auth.response;
  const share = await getSessionShare(auth.sessionId!, auth.userId!);
  return json({ share: share ? describe(share) : null });
}
async function createShare(request: Request, context: Context) {
  const auth = await authorize(context);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  if (!isShareDuration(body?.duration)) return json({ error: "请选择有效的分享时长" }, 400);
  const messages = await getChatMessages(auth.sessionId!, auth.userId!);
  if (!messages.length) return json({ error: "请先添加对话内容" }, 400);
  const current = await getChatSession(auth.sessionId!, auth.userId!);
  if (!current || current.revision !== auth.session!.revision)
    return json({ error: "会话正在更新，请稍后重新生成链接" }, 409);
  const share = await saveConversationShare(
    auth.sessionId!,
    auth.userId!,
    { title: current.title, messages: toReadonlyMessages(messages) },
    body.duration,
  );
  return json({ share: describe(share) });
}
async function deleteShare(_request: Request, context: Context) {
  const auth = await authorize(context);
  if (auth.response) return auth.response;
  await revokeSessionShare(auth.sessionId!, auth.userId!);
  return json({ ok: true });
}

function withShareErrors(handler: (request: Request, context: Context) => Promise<Response>) {
  return async (request: Request, context: Context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Drizzle errors include query parameters (the conversation snapshot).
      // Log only the database code, never the raw error or its parameters.
      let cause: unknown = error;
      let code: string | undefined;
      for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
        if ("code" in cause && typeof cause.code === "string") code = cause.code;
        cause = "cause" in cause ? cause.cause : undefined;
      }
      console.error("[conversation-share] request failed", { code: code ?? "unknown" });
      return code === "42P01"
        ? json({ error: "分享服务尚未就绪，请联系管理员完成数据库更新" }, 503)
        : json({ error: "分享操作失败，请稍后重试" }, 500);
    }
  };
}

export const GET = withShareErrors(getShare);
export const POST = withShareErrors(createShare);
export const DELETE = withShareErrors(deleteShare);
