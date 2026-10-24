import { NextResponse } from "next/server";

import { BUILTIN_TOOLS } from "@/lib/tools/registry";

export const dynamic = "force-dynamic";

/** Read-only built-in tool catalog for anonymous visitors. */
export async function GET() {
  const tools = BUILTIN_TOOLS.map(({ systemPrompt: _systemPrompt, ...tool }) => ({
    ...tool,
    installed: false,
  }));

  return NextResponse.json({ tools }, { headers: { "Cache-Control": "no-store" } });
}
