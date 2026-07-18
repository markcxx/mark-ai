import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";
import { getAvailableBuiltinTool, getBuiltinTool } from "@/lib/tools/registry";
import { installTool, uninstallTool } from "@/lib/tools/storage";

export const runtime = "nodejs";

const getRequestContext = async (req: NextRequest, toolId: string) => {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return { response: authorization.response };

  const limited = enforceRateLimit({
    key: authorization.key,
    limit: 60,
    scope: "tools-write",
  });
  if (limited) return { response: limited };

  const tool = getBuiltinTool(toolId);
  if (!tool) {
    return { response: NextResponse.json({ error: "Tool not found" }, { status: 404 }) };
  }

  return {
    authorization,
    tool,
    userId: authorization.userId || LOCAL_STORAGE_OWNER_ID,
  };
};

export async function POST(req: NextRequest, context: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await context.params;
  const requestContext = await getRequestContext(req, toolId);
  if ("response" in requestContext) return requestContext.response;

  const tool = getAvailableBuiltinTool(toolId);
  if (!tool) {
    return NextResponse.json({ error: "This tool is not ready to install yet" }, { status: 409 });
  }

  await installTool(requestContext.userId, tool.id, tool.version);
  return NextResponse.json({ installed: true, toolId: tool.id });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await context.params;
  const requestContext = await getRequestContext(req, toolId);
  if ("response" in requestContext) return requestContext.response;

  await uninstallTool(requestContext.userId, toolId);
  return NextResponse.json({ installed: false, toolId });
}
