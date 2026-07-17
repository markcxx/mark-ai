import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/api/security";
import { getDb } from "@/lib/db";
import { verifications } from "@/lib/db/schema";
import { sendVerificationCode } from "@/lib/email";
import { eq, and, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CODE_TTL_MS = (Number(process.env.EMAIL_VERIFICATION_TTL_SECONDS) || 600) * 1000;

const RATE_LIMIT_MS = 60_000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  }

  const address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = enforceRateLimit({
    key: `${address}:${email}`,
    limit: 5,
    scope: "send-verification-code",
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  const db = getDb();
  const existing = await db
    .select({ createdAt: verifications.createdAt })
    .from(verifications)
    .where(eq(verifications.identifier, `email-verify:${email}`))
    .limit(1);
  const lastSentAt = existing[0]?.createdAt?.getTime();
  if (lastSentAt && Date.now() - lastSentAt < RATE_LIMIT_MS) {
    const remaining = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSentAt)) / 1000);
    return NextResponse.json({ error: `请${remaining}秒后再试` }, { status: 429 });
  }

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const id = `email-verify:${crypto.randomUUID()}`;

  await db.delete(verifications).where(eq(verifications.identifier, `email-verify:${email}`));

  await db.insert(verifications).values({
    id,
    identifier: `email-verify:${email}`,
    value: code,
    expiresAt,
  });

  await sendVerificationCode(email, code);

  return NextResponse.json({ ok: true });
}
