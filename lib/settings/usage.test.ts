import { expect, it } from "vitest";
import { fillUsageDays } from "./usage";
it("fills empty UTC days across month boundaries without shifting recorded data", () => {
  expect(
    fillUsageDays(
      [{ date: "2026-02-28", messages: 3, totalTokens: 15 }],
      3,
      new Date("2026-03-02T23:00:00Z"),
    ),
  ).toEqual([
    { date: "2026-02-28", messages: 3, totalTokens: 15 },
    { date: "2026-03-01", messages: 0, totalTokens: 0 },
    { date: "2026-03-02", messages: 0, totalTokens: 0 },
  ]);
});
