import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import { createChatSession, listChatSessions } from "@/lib/chat/storage";
import type { SessionListCursor } from "@/lib/chat/storage-adapter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const decodeCursor = (value: string | null): SessionListCursor | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      !parsed ||
      typeof parsed.favorite !== "boolean" ||
      typeof parsed.id !== "string" ||
      !Number.isFinite(parsed.updatedAt)
    ) {
      return undefined;
    }
    return parsed as SessionListCursor;
  } catch {
    return undefined;
  }
};

const encodeCursor = (cursor: SessionListCursor) =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const requestedLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(10, Math.min(50, Math.round(requestedLimit)))
    : 30;
  const query = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100) || undefined;
  const cursorValue = req.nextUrl.searchParams.get("cursor");
  const cursor = decodeCursor(cursorValue);
  if (cursorValue && !cursor) {
    return NextResponse.json({ error: "会话分页游标无效" }, { status: 400 });
  }

  const rows = await listChatSessions(userId, { cursor, limit: limit + 1, query });
  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;
  const last = sessions.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ favorite: Boolean(last.favorite), id: last.id, updatedAt: last.updatedAt })
      : null;

  return NextResponse.json({ nextCursor, sessions }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  const session = await createChatSession({
    initialMessage: typeof body.initialMessage === "string" ? body.initialMessage : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    provider: typeof body.provider === "string" ? body.provider : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    userId,
  });

  return NextResponse.json({ session }, { status: 201 });
}
