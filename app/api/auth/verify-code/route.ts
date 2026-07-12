import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { verifications } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (!email || !code) {
    return NextResponse.json({ error: '请输入邮箱和验证码' }, { status: 400 });
  }

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
    return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
  }

  await db
    .delete(verifications)
    .where(eq(verifications.identifier, `email-verify:${email}`));

  return NextResponse.json({ ok: true, verified: true });
}
