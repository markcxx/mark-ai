import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { conversationShares } from "@/lib/db/schema";
import { isCloudMode } from "@/lib/env";
import type { ConversationSnapshot } from "./share-types";

export type ConversationShare = {
  token: string;
  sessionId: string;
  userId: string;
  snapshot: ConversationSnapshot;
  createdAt: Date;
  expiresAt: Date;
};
const localDb = async () => (await import("./sqlite-storage")).ensureDatabase();
const fromLocal = (row: unknown): ConversationShare | undefined => {
  if (!row) return undefined;
  const value = row as {
    token: string;
    session_id: string;
    user_id: string;
    snapshot: string;
    created_at: number;
    expires_at: number;
  };
  return {
    token: value.token,
    sessionId: value.session_id,
    userId: value.user_id,
    snapshot: JSON.parse(value.snapshot),
    createdAt: new Date(value.created_at),
    expiresAt: new Date(value.expires_at),
  };
};

export async function saveConversationShare(
  sessionId: string,
  userId: string,
  snapshot: ConversationSnapshot,
  duration: number,
) {
  const share: ConversationShare = {
    token: randomBytes(32).toString("base64url"),
    sessionId,
    userId,
    snapshot,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + duration * 1000),
  };
  if (isCloudMode()) {
    await getDb()
      .insert(conversationShares)
      .values(share)
      .onConflictDoUpdate({ target: conversationShares.sessionId, set: share });
  } else {
    (await localDb())
      .prepare(
        `INSERT INTO conversation_shares (token, session_id, user_id, snapshot, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET token=excluded.token, snapshot=excluded.snapshot, created_at=excluded.created_at, expires_at=excluded.expires_at`,
      )
      .run(
        share.token,
        sessionId,
        userId,
        JSON.stringify(snapshot),
        share.createdAt.getTime(),
        share.expiresAt.getTime(),
      );
  }
  return share;
}

export async function getConversationShare(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
  if (isCloudMode()) {
    const [share] = await getDb()
      .select()
      .from(conversationShares)
      .where(and(eq(conversationShares.token, token), gt(conversationShares.expiresAt, new Date())))
      .limit(1);
    return share;
  }
  return fromLocal(
    (await localDb())
      .prepare("SELECT * FROM conversation_shares WHERE token = ? AND expires_at > ?")
      .get(token, Date.now()),
  );
}

export async function getSessionShare(sessionId: string, userId: string) {
  if (isCloudMode()) {
    const [share] = await getDb()
      .select()
      .from(conversationShares)
      .where(
        and(
          eq(conversationShares.sessionId, sessionId),
          eq(conversationShares.userId, userId),
          gt(conversationShares.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return share;
  }
  return fromLocal(
    (await localDb())
      .prepare(
        "SELECT * FROM conversation_shares WHERE session_id = ? AND user_id = ? AND expires_at > ?",
      )
      .get(sessionId, userId, Date.now()),
  );
}

export async function revokeSessionShare(sessionId: string, userId: string) {
  if (isCloudMode()) {
    await getDb()
      .delete(conversationShares)
      .where(
        and(eq(conversationShares.sessionId, sessionId), eq(conversationShares.userId, userId)),
      );
  } else {
    (await localDb())
      .prepare("DELETE FROM conversation_shares WHERE session_id = ? AND user_id = ?")
      .run(sessionId, userId);
  }
}
