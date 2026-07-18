import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { verifications } from "@/lib/db/schema";
import { getValidWaitlistInvitation } from "@/lib/registration";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await getValidWaitlistInvitation({ token });
  if (!result) {
    return NextResponse.json({ error: "邀请链接无效或已过期" }, { status: 400 });
  }

  const registrationToken = randomUUID();
  await getDb()
    .insert(verifications)
    .values({
      expiresAt: new Date(Date.now() + 15 * 60_000),
      id: `email-register:${registrationToken}`,
      identifier: `email-register:${registrationToken}`,
      value: result.entry.email,
    });

  return NextResponse.json({
    email: result.entry.email,
    fullName: result.entry.fullName,
    ok: true,
    registrationToken,
  });
}
