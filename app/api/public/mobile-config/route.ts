import { NextResponse } from "next/server";

import { isCloudMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { cloudMode: isCloudMode(), protocolVersion: 1 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
