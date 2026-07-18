import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest } from "@/lib/api/security";
import { LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";
import { BUILTIN_TOOLS } from "@/lib/tools/registry";
import { listInstalledToolIds } from "@/lib/tools/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;

  const userId = authorization.userId || LOCAL_STORAGE_OWNER_ID;
  const installedIds = new Set(await listInstalledToolIds(userId));
  const tools = BUILTIN_TOOLS.map(({ systemPrompt: _systemPrompt, ...tool }) => ({
    ...tool,
    installed: installedIds.has(tool.id),
  }));

  return NextResponse.json({ tools }, { headers: { "Cache-Control": "no-store" } });
}
