import { randomUUID } from 'node:crypto';

import { and, count, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/db';
import { storageFiles, users } from '@/lib/db/schema';
import { isAllowedUploadType, storageLimits } from '@/lib/storage/limits';
import { createUploadUrl, getR2Bucket } from '@/lib/storage/r2';

export const runtime = 'nodejs';

const safeExtension = (name: string) => {
  const match = name.toLowerCase().match(/\.[a-z0-9]{1,10}$/);
  return match?.[0] || '';
};

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 240) : '';
  const contentType = typeof body?.contentType === 'string' ? body.contentType : '';
  const size = Number(body?.size);
  const kind = body?.kind === 'avatar' ? 'avatar' : 'attachment';
  if (!name || !Number.isSafeInteger(size) || size <= 0 || !isAllowedUploadType(contentType, kind)) {
    return NextResponse.json({ error: '文件名称、大小或格式不受支持' }, { status: 400 });
  }

  const maxBytes = kind === 'avatar' ? storageLimits.maxAvatarBytes : storageLimits.maxFileBytes;
  if (size > maxBytes) {
    return NextResponse.json({ error: `文件不能超过 ${Math.ceil(maxBytes / 1024 / 1024)} MB` }, { status: 413 });
  }

  const db = getDb();
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  if (user.role !== 'admin' && kind !== 'avatar') {
    const [usage] = await db
      .select({ total: sql<number>`coalesce(sum(${storageFiles.size}), 0)`, files: count(storageFiles.id) })
      .from(storageFiles)
      .where(and(
        eq(storageFiles.userId, userId),
        eq(storageFiles.kind, 'attachment'),
        eq(storageFiles.status, 'ready'),
      ));
    if (Number(usage?.files || 0) >= storageLimits.maxFileCount) {
      return NextResponse.json({ error: '文件数量已达到上限' }, { status: 413 });
    }
    if (Number(usage?.total || 0) + size > storageLimits.maxStorageBytes) {
      return NextResponse.json({ error: '存储空间不足，请删除旧文件后重试' }, { status: 413 });
    }
  }

  const id = randomUUID();
  const bucket = getR2Bucket(kind);
  const objectKey = kind === 'avatar'
    ? `avatars/${userId}/${id}${safeExtension(name)}`
    : `users/${userId}/attachments/${id}${safeExtension(name)}`;

  await db.insert(storageFiles).values({
    bucket, contentType, id, kind, objectKey, originalName: name, size, status: 'pending', userId,
  });

  return NextResponse.json({
    file: { contentType, id, kind, name, size },
    uploadUrl: await createUploadUrl({ bucket, contentType, key: objectKey }),
  });
}
