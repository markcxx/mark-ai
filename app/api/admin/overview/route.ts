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
  const activityStartDate = new Date(startDate);
  activityStartDate.setDate(activityStartDate.getDate() - (90 - rangeDays));
  const [
    userCount,
    verifiedUserCount,
    bannedUserCount,
    pendingCount,
    sessionCount,
    messageCount,
    fileStats,
    emailStatusCounts,
    recentUsers,
    recentSessions,
    recentActivitySessions,
    recentMessages,
    recentFiles,
    fileTypes,
    providerTypes,
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
    db
      .select({ status: emailDeliveries.status, value: count() })
      .from(emailDeliveries)
      .groupBy(emailDeliveries.status),
    db.select({ createdAt: users.createdAt }).from(users).where(gte(users.createdAt, startDate)),
    db
      .select({ createdAt: chatSessions.createdAt })
      .from(chatSessions)
      .where(gte(chatSessions.createdAt, startDate)),
    db
      .select({ createdAt: chatSessions.createdAt })
      .from(chatSessions)
      .where(gte(chatSessions.createdAt, activityStartDate)),
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
  const activityTrend = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(activityStartDate);
    date.setDate(activityStartDate.getDate() + index);
    const key = dayKey(date);
    return {
      date: key,
      sessions: recentActivitySessions.filter((item) => dayKey(item.createdAt) === key).length,
    };
  });
  const fileTypeMap = new Map<string, number>();
  for (const row of fileTypes) {
    const category = row.contentType.split("/")[0] || "other";
    fileTypeMap.set(category, (fileTypeMap.get(category) || 0) + Number(row.bytes || 0));
  }
  const sentEmails = Number(
    emailStatusCounts.find((item) => item.status === "sent")?.value || 0,
  );
  const failedEmails = Number(
    emailStatusCounts.find((item) => item.status === "failed")?.value || 0,
  );
  const attemptedEmails = sentEmails + failedEmails;
  return NextResponse.json({
    providerTypes: providerTypes
      .map((item) => ({ name: item.name || "未知服务商", value: Number(item.value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    rangeDays,
    activityTrend,
    stats: {
      bannedUsers: bannedUserCount[0]?.value || 0,
      emailDeliveryRate: attemptedEmails ? (sentEmails / attemptedEmails) * 100 : null,
      failedEmails,
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
    fileTypes: Array.from(fileTypeMap, ([name, value]) => ({ name, value })),
  });
}
