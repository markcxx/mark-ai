import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";
import { getChatSession } from "@/lib/chat/storage";
import { getAvailableBuiltinTool } from "@/lib/tools/registry";
import {
  listInstalledToolIds,
  listSessionEnabledToolIds,
  replaceSessionEnabledTools,
} from "@/lib/tools/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getOwnedSession = async (req: NextRequest, sessionId: string) => {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return { response: authorization.response };

  const storageUserId = authorization.userId || LOCAL_STORAGE_OWNER_ID;
  const session = await getChatSession(sessionId, authorization.userId);
  if (!session) {
    return { response: NextResponse.json({ error: "Session not found" }, { status: 404 }) };
  }

  return { authorization, storageUserId };
};

export async function GET(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const requestContext = await getOwnedSession(req, sessionId);
  if ("response" in requestContext) return requestContext.response;

  const [sessionToolIds, installedToolIds] = await Promise.all([
    listSessionEnabledToolIds(requestContext.storageUserId, sessionId),
    listInstalledToolIds(requestContext.storageUserId),
  ]);
  const installed = new Set(installedToolIds);
  const toolIds = sessionToolIds.filter(
    (id) => installed.has(id) && Boolean(getAvailableBuiltinTool(id)),
  );
  return NextResponse.json({ toolIds }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const requestContext = await getOwnedSession(req, sessionId);
  if ("response" in requestContext) return requestContext.response;

  const limited = enforceRateLimit({
    key: requestContext.authorization.key,
    limit: 120,
    scope: "session-tools-write",
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.toolIds) || body.toolIds.length > 20) {
    return NextResponse.json({ error: "Invalid tool list" }, { status: 400 });
  }

  const requestedIds: string[] = [
    ...new Set((body.toolIds as unknown[]).filter((id): id is string => typeof id === "string")),
  ];
  const installedIds = new Set(await listInstalledToolIds(requestContext.storageUserId));
  const toolIds = requestedIds.filter(
    (id) => installedIds.has(id) && Boolean(getAvailableBuiltinTool(id)),
  );

  await replaceSessionEnabledTools(requestContext.storageUserId, sessionId, toolIds);
  return NextResponse.json({ toolIds });
}
