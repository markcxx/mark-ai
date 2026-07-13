import { NextRequest, NextResponse } from 'next/server';

import { isCloudMode } from '@/lib/env';

type AuthorizedRequest = {
  authorized: true;
  key: string;
  userId?: string;
};

type RejectedRequest = {
  authorized: false;
  response: NextResponse;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const globalRateLimits = globalThis as typeof globalThis & {
  __markaiRateLimits?: Map<string, RateLimitBucket>;
};

const rateLimits = globalRateLimits.__markaiRateLimits ?? new Map<string, RateLimitBucket>();
globalRateLimits.__markaiRateLimits = rateLimits;

const getClientAddress = (req: NextRequest) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  req.headers.get('x-real-ip')?.trim() ||
  'local';

export const authorizeApiRequest = async (
  req: NextRequest,
): Promise<AuthorizedRequest | RejectedRequest> => {
  if (!isCloudMode()) {
    return { authorized: true, key: `ip:${getClientAddress(req)}` };
  }

  const { auth } = await import('@/lib/auth');
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { authorized: true, key: `user:${session.user.id}`, userId: session.user.id };
};

export const enforceRateLimit = ({
  key,
  limit,
  scope,
  windowMs = 60_000,
}: {
  key: string;
  limit: number;
  scope: string;
  windowMs?: number;
}) => {
  const now = Date.now();
  const bucketKey = `${scope}:${key}`;
  const current = rateLimits.get(bucketKey);

  if (!current || current.resetAt <= now) {
    rateLimits.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      { headers: { 'Retry-After': String(retryAfter) }, status: 429 },
    );
  }

  current.count += 1;

  if (rateLimits.size > 10_000) {
    for (const [storedKey, bucket] of rateLimits) {
      if (bucket.resetAt <= now) rateLimits.delete(storedKey);
    }
  }

  return null;
};
