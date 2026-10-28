export type StatMetric = { value: number; previous: number };
export type ActivityDay = { date: string; messages: number; tokens: number };
export type StatisticsRank = { id: string; name: string; provider?: string; count: number };
export type StatisticsOverview = {
  name: string;
  createdAt: string | null;
  lastActiveAt: string | null;
  days: number;
  metrics: { assistants: StatMetric; topics: StatMetric; messages: StatMetric; tokens: StatMetric };
  activity: ActivityDay[];
  longestTaskMs: number | null;
  ranks: { models: StatisticsRank[]; assistants: StatisticsRank[]; topics: StatisticsRank[] };
};
export type UsageRecord = {
  id: string;
  sessionId: string;
  createdAt: string;
  model: string;
  provider: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  source: string | null;
  interrupted: boolean;
};
export type MonthlyUsage = {
  month: string;
  total: number;
  page: number;
  pageSize: number;
  records: UsageRecord[];
  daily: { date: string; provider: string; model: string; calls: number; tokens: number }[];
  // Historical messages do not contain a price snapshot or actual charge.
  billingAvailable: false;
};
export function utcMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}
export function monthBounds(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}
export function activityStats(days: ActivityDay[], field: "messages" | "tokens") {
  let peak = 0,
    longest = 0,
    run = 0,
    active = 0;
  for (const day of days) {
    peak = Math.max(peak, day[field]);
    if (day[field] > 0) {
      active++;
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i][field] > 0) current++;
    else if (i !== days.length - 1) break;
  }
  return {
    peak,
    longest,
    current,
    active,
    hot: days.filter((d) => peak > 0 && d[field] >= peak * 0.5).length,
  };
}
export function fillActivity(rows: ActivityDay[], now: Date): ActivityDay[] {
  const start = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const result: ActivityDay[] = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10),
      row = byDate.get(key);
    result.push({
      date: key,
      messages: Number(row?.messages || 0),
      tokens: Number(row?.tokens || 0),
    });
  }
  return result;
}
