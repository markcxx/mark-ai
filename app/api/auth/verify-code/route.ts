import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/api/security";
import { getDb } from "@/lib/db";
import { verifications } from "@/lib/db/schema";
import { getRegistrationMode } from "@/lib/registration";
import { eq, and, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REGISTRATION_TOKEN_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (getRegistrationMode() !== "open") {
    return NextResponse.json({ error: "当前未开放直接注册" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!email || !code) {
    return NextResponse.json({ error: "请输入邮箱和验证码" }, { status: 400 });
  }

  const address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = enforceRateLimit({
    key: `${address}:${email}`,
    limit: 10,
    scope: "verify-email-code",
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  const db = getDb();
  const rows = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.identifier, `email-verify:${email}`),
        eq(verifications.value, code),
        gt(verifications.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }

  await db.delete(verifications).where(eq(verifications.identifier, `email-verify:${email}`));

  const registrationToken = randomUUID();
  await db.insert(verifications).values({
    id: `email-register:${registrationToken}`,
    identifier: `email-register:${registrationToken}`,
    value: email,
    expiresAt: new Date(Date.now() + REGISTRATION_TOKEN_TTL_MS),
  });

  return NextResponse.json({ ok: true, registrationToken, verified: true });
}
