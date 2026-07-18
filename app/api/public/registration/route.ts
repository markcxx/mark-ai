import { NextResponse } from "next/server";

import { getRegistrationMode } from "@/lib/registration";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { mode: getRegistrationMode() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
