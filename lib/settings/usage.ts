export type UsageModel = {
  provider: string;
  model: string;
  messages: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number;
  measuredMessages: number;
};
export type SettingsUsage = {
  days: number;
  sessions: number;
  messages: number;
  assistantMessages: number;
  totalTokens: number;
  measuredMessages: number;
  models: UsageModel[];
  daily: { date: string; messages: number; totalTokens: number }[];
};
export function fillUsageDays(
  rows: SettingsUsage["daily"],
  days: number,
  now = new Date(),
): SettingsUsage["daily"] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + index + 1),
    )
      .toISOString()
      .slice(0, 10);
    const row = byDate.get(date);
    return {
      date,
      messages: Number(row?.messages || 0),
      totalTokens: Number(row?.totalTokens || 0),
    };
  });
}
