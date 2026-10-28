import { and, count, eq, gte, sql } from "drizzle-orm";
import { isCloudMode } from "@/lib/env";
import { fillUsageDays, type SettingsUsage, type UsageModel } from "./usage";

export async function getSettingsUsage(
  userId: string | undefined,
  days: number,
): Promise<SettingsUsage> {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1),
  );
  if (!isCloudMode()) {
    const { ensureDatabase } = await import("@/lib/chat/sqlite-storage");
    const db = ensureDatabase();
    const summary = db
      .prepare(
        `SELECT count(*) AS messages, sum(CASE WHEN role = 'model' THEN 1 ELSE 0 END) AS assistantMessages,
      coalesce(sum(CASE WHEN role = 'model' THEN coalesce(total_tokens, input_tokens + output_tokens, 0) ELSE 0 END), 0) AS totalTokens,
      sum(CASE WHEN role = 'model' AND (total_tokens IS NOT NULL OR (input_tokens IS NOT NULL AND output_tokens IS NOT NULL)) THEN 1 ELSE 0 END) AS measuredMessages
      FROM chat_messages WHERE created_at >= ?`,
      )
      .get(start.getTime()) as Record<string, number>;
    const sessions = db
      .prepare("SELECT count(*) AS value FROM chat_sessions WHERE created_at >= ?")
      .get(start.getTime()) as { value: number };
    const models = db
      .prepare(
        `SELECT coalesce(provider, '未记录') AS provider, coalesce(model, '未记录') AS model, count(*) AS messages,
      sum(input_tokens) AS inputTokens, sum(output_tokens) AS outputTokens,
      coalesce(sum(coalesce(total_tokens, input_tokens + output_tokens, 0)),0) AS totalTokens,
      sum(CASE WHEN total_tokens IS NOT NULL OR (input_tokens IS NOT NULL AND output_tokens IS NOT NULL) THEN 1 ELSE 0 END) AS measuredMessages
      FROM chat_messages WHERE role = 'model' AND created_at >= ? GROUP BY provider, model ORDER BY totalTokens DESC`,
      )
      .all(start.getTime()) as UsageModel[];
    const daily = db
      .prepare(
        `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS date, count(*) AS messages,
      coalesce(sum(CASE WHEN role = 'model' THEN coalesce(total_tokens, input_tokens + output_tokens, 0) ELSE 0 END), 0) AS totalTokens
      FROM chat_messages WHERE created_at >= ? GROUP BY date`,
      )
      .all(start.getTime()) as SettingsUsage["daily"];
    return {
      days,
      sessions: sessions.value,
      messages: summary.messages,
      assistantMessages: summary.assistantMessages || 0,
      totalTokens: summary.totalTokens,
      measuredMessages: summary.measuredMessages || 0,
      models,
      daily: fillUsageDays(daily, days, now),
    };
  }
  if (!userId) throw new Error("请先登录");
  const { getDb } = await import("@/lib/db");
  const { chatMessages: m, chatSessions: s } = await import("@/lib/db/schema");
  const db = getDb();
  const where = and(eq(s.userId, userId), gte(m.createdAt, start));
  const tokenSum = sql<number>`coalesce(sum(case when ${m.role} = 'model' then coalesce(${m.totalTokens}, ${m.inputTokens} + ${m.outputTokens}, 0) else 0 end),0)`;
  const measured = sql<number>`count(*) filter (where ${m.role} = 'model' and (${m.totalTokens} is not null or (${m.inputTokens} is not null and ${m.outputTokens} is not null)))`;
  const day = sql<string>`to_char(${m.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const [summary, sessions, daily, models] = await Promise.all([
    db
      .select({
        messages: count(),
        assistantMessages: sql<number>`count(*) filter (where ${m.role} = 'model')`,
        totalTokens: tokenSum,
        measuredMessages: measured,
      })
      .from(m)
      .innerJoin(s, eq(s.id, m.sessionId))
      .where(where),
    db
      .select({ value: count() })
      .from(s)
      .where(and(eq(s.userId, userId), gte(s.createdAt, start))),
    db
      .select({ date: day, messages: count(), totalTokens: tokenSum })
      .from(m)
      .innerJoin(s, eq(s.id, m.sessionId))
      .where(where)
      .groupBy(day),
    db
      .select({
        provider: m.provider,
        model: m.model,
        messages: count(),
        inputTokens: sql<number | null>`sum(${m.inputTokens})`,
        outputTokens: sql<number | null>`sum(${m.outputTokens})`,
        totalTokens: tokenSum,
        measuredMessages: measured,
      })
      .from(m)
      .innerJoin(s, eq(s.id, m.sessionId))
      .where(and(where, eq(m.role, "model")))
      .groupBy(m.provider, m.model)
      .orderBy(sql`${tokenSum} desc`),
  ]);
  const result = summary[0];
  return {
    days,
    sessions: Number(sessions[0]?.value || 0),
    messages: Number(result?.messages || 0),
    assistantMessages: Number(result?.assistantMessages || 0),
    totalTokens: Number(result?.totalTokens || 0),
    measuredMessages: Number(result?.measuredMessages || 0),
    daily: fillUsageDays(daily, days, now),
    models: models.map((row) => ({
      provider: row.provider || "未记录",
      model: row.model || "未记录",
      messages: Number(row.messages),
      inputTokens: row.inputTokens === null ? null : Number(row.inputTokens),
      outputTokens: row.outputTokens === null ? null : Number(row.outputTokens),
      totalTokens: Number(row.totalTokens),
      measuredMessages: Number(row.measuredMessages),
    })),
  };
}
