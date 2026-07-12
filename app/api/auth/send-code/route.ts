import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { verifications } from '@/lib/db/schema';
import { sendVerificationCode } from '@/lib/email';
import { eq, and, gt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CODE_TTL_MS = (Number(process.env.EMAIL_VERIFICATION_TTL_SECONDS) || 600) * 1000;

const RATE_LIMIT = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
  }

  const lastSent = RATE_LIMIT.get(email);
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
    const remaining = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSent)) / 1000);
    return NextResponse.json(
      { error: `请${remaining}秒后再试` },
      { status: 429 },
    );
  }

  const db = getDb();
  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const id = `email-verify:${crypto.randomUUID()}`;

  await db
    .delete(verifications)
    .where(eq(verifications.identifier, `email-verify:${email}`));

  await db.insert(verifications).values({
    id,
    identifier: `email-verify:${email}`,
    value: code,
    expiresAt,
  });

  await sendVerificationCode(email, code);
  RATE_LIMIT.set(email, Date.now());

  return NextResponse.json({ ok: true });
}
