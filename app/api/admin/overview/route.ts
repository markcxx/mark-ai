import { and, count, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/api";
import { getDb } from "@/lib/db";
import {
  chatMessages,
  chatSessions,
  emailDeliveries,
  storageFiles,
  users,
  waitlistEntries,
} from "@/lib/db/schema";

export async function GET(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const db = getDb();
  const requestedDays = Number(new URL(request.url).searchParams.get("days"));
  const rangeDays = [7, 14, 30].includes(requestedDays) ? requestedDays : 14;
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (rangeDays - 1));
  const [
    userCount,
    verifiedUserCount,
    bannedUserCount,
    pendingCount,
    sessionCount,
    messageCount,
    fileStats,
    failedEmailCount,
    recentUsers,
    recentSessions,
    recentMessages,
    recentFiles,
    waitlistStatuses,
    fileTypes,
    providerTypes,
    roleTypes,
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(users).where(eq(users.emailVerified, true)),
    db.select({ value: count() }).from(users).where(eq(users.banned, true)),
    db
      .select({ value: count() })
      .from(waitlistEntries)
      .where(eq(waitlistEntries.status, "pending")),
    db.select({ value: count() }).from(chatSessions),
    db.select({ value: count() }).from(chatMessages),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${storageFiles.size}), 0)::bigint`,
        value: count(),
      })
      .from(storageFiles)
      .where(and(eq(storageFiles.kind, "attachment"), eq(storageFiles.status, "ready"))),
    db.select({ value: count() }).from(emailDeliveries).where(eq(emailDeliveries.status, "failed")),
    db.select({ createdAt: users.createdAt }).from(users).where(gte(users.createdAt, startDate)),
    db
      .select({ createdAt: chatSessions.createdAt })
      .from(chatSessions)
      .where(gte(chatSessions.createdAt, startDate)),
    db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(gte(chatMessages.createdAt, startDate)),
    db
      .select({ createdAt: storageFiles.createdAt })
      .from(storageFiles)
      .where(
        and(
          gte(storageFiles.createdAt, startDate),
          eq(storageFiles.kind, "attachment"),
          eq(storageFiles.status, "ready"),
        ),
      ),
    db
      .select({ status: waitlistEntries.status, value: count() })
      .from(waitlistEntries)
      .groupBy(waitlistEntries.status),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${storageFiles.size}), 0)::bigint`,
        contentType: storageFiles.contentType,
      })
      .from(storageFiles)
      .where(and(eq(storageFiles.kind, "attachment"), eq(storageFiles.status, "ready")))
      .groupBy(storageFiles.contentType),
    db
      .select({ name: chatSessions.provider, value: count() })
      .from(chatSessions)
      .groupBy(chatSessions.provider),
    db.select({ name: users.role, value: count() }).from(users).groupBy(users.role),
  ]);

  const dayKey = (date: Date) => date.toISOString().slice(0, 10);
  const trend = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = dayKey(date);
    return {
      date: key,
      files: recentFiles.filter((item) => dayKey(item.createdAt) === key).length,
      messages: recentMessages.filter((item) => dayKey(item.createdAt) === key).length,
      sessions: recentSessions.filter((item) => dayKey(item.createdAt) === key).length,
      users: recentUsers.filter((item) => dayKey(item.createdAt) === key).length,
    };
  });
  const fileTypeMap = new Map<string, number>();
  for (const row of fileTypes) {
    const category = row.contentType.split("/")[0] || "other";
    fileTypeMap.set(category, (fileTypeMap.get(category) || 0) + Number(row.bytes || 0));
  }
  return NextResponse.json({
    providerTypes: providerTypes
      .map((item) => ({ name: item.name || "未知服务商", value: Number(item.value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    rangeDays,
    roleTypes: roleTypes.map((item) => ({
      name: item.name || "user",
      value: Number(item.value),
    })),
    stats: {
      bannedUsers: bannedUserCount[0]?.value || 0,
      failedEmails: failedEmailCount[0]?.value || 0,
      fileBytes: Number(fileStats[0]?.bytes || 0),
      files: fileStats[0]?.value || 0,
      messages: messageCount[0]?.value || 0,
      newUsers: recentUsers.length,
      pendingWaitlist: pendingCount[0]?.value || 0,
      sessions: sessionCount[0]?.value || 0,
      users: userCount[0]?.value || 0,
      verifiedUsers: verifiedUserCount[0]?.value || 0,
    },
    trend,
    waitlistStatuses: waitlistStatuses.map((item) => ({
      name: item.status,
      value: Number(item.value),
    })),
    fileTypes: Array.from(fileTypeMap, ([name, value]) => ({ name, value })),
  });
}
