import { expect, it } from "vitest";
import { activityStats, fillActivity, monthBounds } from "./statistics";
it("includes leap day and fills missing days with UTC zeros", () => {
  const result = fillActivity(
    [{ date: "2024-02-29", messages: 2, tokens: 15 }],
    new Date("2024-03-01T12:00:00Z"),
  );
  expect(result).toHaveLength(366);
  expect(result[0].date).toBe("2023-03-02");
  expect(result.at(-1)).toEqual({ date: "2024-03-01", messages: 0, tokens: 0 });
  expect(result.find((d) => d.date === "2024-02-29")?.tokens).toBe(15);
});
it("does not break current streak when today is empty, but breaks gaps before today", () => {
  const rows = [1, 2, 0, 3, 4, 0].map((tokens, i) => ({
    date: String(i),
    messages: tokens,
    tokens,
  }));
  expect(activityStats(rows, "tokens")).toMatchObject({
    current: 2,
    longest: 2,
    active: 4,
    peak: 4,
  });
  expect(activityStats(rows.slice(0, 3), "tokens").current).toBe(2);
  expect(
    activityStats(
      rows.map((r) => ({ ...r, tokens: 0 })),
      "tokens",
    ),
  ).toMatchObject({ current: 0, longest: 0, hot: 0 });
});
it("bounds monthly queries across year transitions", () => {
  expect(monthBounds("2026-12").end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
});
