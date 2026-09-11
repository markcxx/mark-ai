import { sql } from "drizzle-orm";

import { identifyClient } from "@/lib/client-platform";
import { getDb } from "@/lib/db";
import { userPlatforms } from "@/lib/db/schema";

const UPDATE_INTERVAL = 5 * 60_000;
const recent = new Map<string, { at: number; version: string | null }>();
const pending = new Map<string, Promise<void>>();

export async function recordUserPlatform(userId: string, requestHeaders: Headers): Promise<void> {
  const client = identifyClient(requestHeaders);
  const key = `${userId}:${client.platform}`;
  const existing = pending.get(key);
  if (existing) await existing;
  const now = Date.now();
  const previous = recent.get(key);
  if (previous && now - previous.at < UPDATE_INTERVAL && previous.version === client.appVersion)
    return;

  const write = (async () => {
    try {
      const seenAt = new Date(now);
      await getDb()
        .insert(userPlatforms)
        .values({
          userId,
          ...client,
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
        })
        .onConflictDoUpdate({
          target: [userPlatforms.userId, userPlatforms.platform],
          set: { appVersion: client.appVersion, lastSeenAt: seenAt },
          setWhere: sql`${userPlatforms.lastSeenAt} <= ${seenAt} and (
          ${userPlatforms.lastSeenAt} <= ${new Date(now - UPDATE_INTERVAL)} or
          ${userPlatforms.appVersion} is distinct from ${client.appVersion}
        )`,
        });
      if (recent.size >= 10_000) recent.delete(recent.keys().next().value!);
      recent.set(key, { at: now, version: client.appVersion });
    } catch {
      // Tracking must not prevent sign-in, chat, or other authenticated work.
      console.warn("用户平台使用记录写入失败");
    }
  })();
  pending.set(key, write);
  try {
    await write;
  } finally {
    if (pending.get(key) === write) pending.delete(key);
  }
}
