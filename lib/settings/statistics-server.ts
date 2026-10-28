import { sql } from "drizzle-orm";
import { isCloudMode } from "@/lib/env";
import {
  fillActivity,
  monthBounds,
  utcMonth,
  type MonthlyUsage,
  type StatisticsOverview,
  type StatisticsRank,
} from "./statistics";

type Row = Record<string, string | number | null>;
type Query = (statement: string, values?: (string | number)[]) => Promise<Row[]>;

// Both clients use the same API. Only the SQL date expressions differ by storage engine.
async function statisticsDb(userId: string | undefined) {
  if (!isCloudMode()) {
    const { ensureDatabase } = await import("@/lib/chat/sqlite-storage");
    const db = ensureDatabase();
    const query: Query = async (statement, values = []) =>
      db.prepare(statement).all(...values) as Row[];
    return {
      query,
      scope: "1 = 1",
      values: [] as string[],
      time: "m.created_at",
      sessionTime: "s.created_at",
      day: "strftime('%Y-%m-%d', m.created_at / 1000, 'unixepoch')",
      cloud: false,
    };
  }
  if (!userId) throw new Error("请先登录");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const query: Query = async (statement, values = []) => {
    const parts = statement.split("?");
    if (parts.length - 1 !== values.length) throw new Error("Invalid statistics query");
    const fragments = parts.flatMap((part, i) =>
      i < values.length ? [sql.raw(part), sql`${values[i]}`] : [sql.raw(part)],
    );
    const result = await db.execute(sql.join(fragments, sql.raw("")));
    return result.rows as Row[];
  };
  return {
    query,
    scope: "s.user_id = ?",
    values: [userId],
    time: "(extract(epoch from m.created_at) * 1000)",
    sessionTime: "(extract(epoch from s.created_at) * 1000)",
    day: "to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD')",
    cloud: true,
  };
}
const tokens = "coalesce(m.total_tokens, m.input_tokens + m.output_tokens)";
const join = "FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.session_id";
const numeric = (value: unknown) => Number(value || 0);
const iso = (value: unknown) => (value == null ? null : new Date(Number(value)).toISOString());
const rank = (rows: Row[]): StatisticsRank[] =>
  rows.map((r) => ({
    id: String(r.id),
    name: String(r.name || r.id),
    ...(r.provider ? { provider: String(r.provider) } : {}),
    count: numeric(r.count),
  }));

export async function getStatisticsOverview(
  userId: string | undefined,
  now = new Date(),
): Promise<StatisticsOverview> {
  const { query, scope, values, time, sessionTime, day, cloud } = await statisticsDb(userId);
  const cutoff = monthBounds(utcMonth(now)).start.getTime();
  const yearStart = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1),
  ).getTime();
  const [summaryRows, sessionRows, activity, models, topics, profileRows] = await Promise.all([
    query(
      `SELECT count(*) AS messages, sum(CASE WHEN ${time} < ? THEN 1 ELSE 0 END) AS previous_messages,
      coalesce(sum(CASE WHEN m.role = 'model' THEN ${tokens} ELSE 0 END),0) AS tokens,
      coalesce(sum(CASE WHEN m.role = 'model' AND ${time} < ? THEN ${tokens} ELSE 0 END),0) AS previous_tokens,
      max(CASE WHEN m.role = 'model' THEN m.generation_duration END) AS longest,
      max(${time}) AS last_active, sum(CASE WHEN m.role = 'model' THEN 1 ELSE 0 END) AS replies
      ${join} WHERE ${scope}`,
      [cutoff, cutoff, ...values],
    ),
    query(
      `SELECT count(*) AS topics, sum(CASE WHEN ${sessionTime} < ? THEN 1 ELSE 0 END) AS previous_topics, min(${sessionTime}) AS first_active FROM chat_sessions s WHERE ${scope}`,
      [cutoff, ...values],
    ),
    query(
      `SELECT ${day} AS date, count(*) AS messages, coalesce(sum(CASE WHEN m.role = 'model' THEN ${tokens} ELSE 0 END),0) AS tokens ${join} WHERE ${scope} AND ${time} >= ? AND ${time} <= ? GROUP BY ${day} ORDER BY date`,
      [...values, yearStart, now.getTime()],
    ),
    query(
      `SELECT coalesce(m.model,'未记录') AS id, coalesce(m.model,'未记录') AS name, coalesce(m.provider,'未记录') AS provider, count(*) AS count ${join} WHERE ${scope} AND m.role = 'model' GROUP BY m.provider, m.model ORDER BY count DESC, provider, id LIMIT 50`,
      values,
    ),
    query(
      `SELECT s.id AS id, s.title AS name, count(*) AS count ${join} WHERE ${scope} GROUP BY s.id, s.title ORDER BY count DESC, s.id LIMIT 50`,
      values,
    ),
    cloud
      ? query(
          "SELECT full_name AS name, (extract(epoch from created_at) * 1000) AS created FROM users WHERE id = ?",
          [userId!],
        )
      : Promise.resolve([]),
  ]);
  const summary = summaryRows[0] || {},
    sessions = sessionRows[0] || {},
    profile = profileRows[0];
  const created = profile?.created ?? sessions.first_active;
  return {
    name: String(profile?.name || "你"),
    createdAt: iso(created),
    lastActiveAt: iso(summary.last_active),
    days:
      created == null
        ? 0
        : Math.max(1, Math.floor((now.getTime() - Number(created)) / 86400000) + 1),
    metrics: {
      // MarkAI currently provides one built-in assistant; models are ranked separately.
      assistants: { value: 1, previous: created != null && Number(created) < cutoff ? 1 : 0 },
      topics: { value: numeric(sessions.topics), previous: numeric(sessions.previous_topics) },
      messages: { value: numeric(summary.messages), previous: numeric(summary.previous_messages) },
      tokens: { value: numeric(summary.tokens), previous: numeric(summary.previous_tokens) },
    },
    activity: fillActivity(
      activity.map((r) => ({
        date: String(r.date),
        messages: numeric(r.messages),
        tokens: numeric(r.tokens),
      })),
      now,
    ),
    longestTaskMs: summary.longest == null ? null : Number(summary.longest),
    ranks: {
      models: rank(models),
      topics: rank(topics),
      assistants: numeric(summary.replies)
        ? [{ id: "markai", name: "MarkAI", count: numeric(summary.replies) }]
        : [],
    },
  };
}

export async function getMonthlyUsage(
  userId: string | undefined,
  month: string,
  page: number,
  pageSize: number,
  sort: "time" | "tokens" = "time",
  direction: "asc" | "desc" = "desc",
): Promise<MonthlyUsage> {
  const { query, scope, values, time, day } = await statisticsDb(userId);
  const { start, end } = monthBounds(month);
  const where = `${scope} AND m.role = 'model' AND ${time} >= ? AND ${time} < ?`;
  const parameters = [...values, start.getTime(), end.getTime()];
  const [countRows, daily] = await Promise.all([
    query(`SELECT count(*) AS total ${join} WHERE ${where}`, parameters),
    query(
      `SELECT ${day} AS date, coalesce(m.provider,'未记录') AS provider, coalesce(m.model,'未记录') AS model, count(*) AS calls, coalesce(sum(${tokens}),0) AS tokens ${join} WHERE ${where} GROUP BY ${day}, m.provider, m.model ORDER BY date`,
      parameters,
    ),
  ]);
  const total = numeric(countRows[0]?.total);
  const actualPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const order = sort === "tokens" ? `coalesce(${tokens}, -1)` : time;
  const rows = await query(
    `SELECT m.id, m.session_id, ${time} AS created, m.model, m.provider, m.input_tokens, m.output_tokens, ${tokens} AS total_tokens, m.generation_duration, m.token_usage_source, m.interrupted ${join} WHERE ${where} ORDER BY ${order} ${direction === "asc" ? "ASC" : "DESC"}, m.id LIMIT ? OFFSET ?`,
    [...parameters, pageSize, (actualPage - 1) * pageSize],
  );
  const nullable = (v: unknown) => (v == null ? null : Number(v));
  return {
    month,
    total,
    page: actualPage,
    pageSize,
    billingAvailable: false,
    daily: daily.map((r) => ({
      date: String(r.date),
      provider: String(r.provider),
      model: String(r.model),
      calls: numeric(r.calls),
      tokens: numeric(r.tokens),
    })),
    records: rows.map((r) => ({
      id: String(r.id),
      sessionId: String(r.session_id),
      createdAt: iso(r.created)!,
      model: String(r.model || "未记录"),
      provider: String(r.provider || "未记录"),
      inputTokens: nullable(r.input_tokens),
      outputTokens: nullable(r.output_tokens),
      totalTokens: nullable(r.total_tokens),
      durationMs: nullable(r.generation_duration),
      source: r.token_usage_source == null ? null : String(r.token_usage_source),
      interrupted: Boolean(r.interrupted),
    })),
  };
}
