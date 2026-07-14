import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth-helpers';
import { getDb } from '@/lib/db';
import { storageFiles, users } from '@/lib/db/schema';
import { storageLimits } from '@/lib/storage/limits';
import { deleteR2Object, getPublicObjectUrl, headR2Object } from '@/lib/storage/r2';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const db = getDb();
  const [file] = await db.select().from(storageFiles)
    .where(and(eq(storageFiles.id, id), eq(storageFiles.userId, userId))).limit(1);
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  try {
    const object = await headR2Object(file.bucket, file.objectKey);
    const actualSize = Number(object.ContentLength || 0);
    const maxBytes = file.kind === 'avatar' ? storageLimits.maxAvatarBytes : storageLimits.maxFileBytes;
    if (actualSize <= 0 || actualSize > maxBytes || actualSize !== file.size) {
      await deleteR2Object(file.bucket, file.objectKey).catch(() => undefined);
      await db.delete(storageFiles).where(eq(storageFiles.id, file.id));
      return NextResponse.json({ error: '上传文件校验失败' }, { status: 400 });
    }

    await db.update(storageFiles).set({ status: 'ready', updatedAt: new Date() })
      .where(eq(storageFiles.id, file.id));

    let url: string | undefined;
    if (file.kind === 'avatar') {
      url = getPublicObjectUrl(file.objectKey);
      await db.update(users).set({ avatar: url, updatedAt: new Date() }).where(eq(users.id, userId));
    }
    return NextResponse.json({ file: {
      contentType: file.contentType, id: file.id, kind: file.kind, name: file.originalName, size: file.size, url,
    } });
  } catch (error) {
    console.error('R2 upload complete error:', error);
    return NextResponse.json({ error: 'R2 中未找到上传文件' }, { status: 400 });
  }
}
