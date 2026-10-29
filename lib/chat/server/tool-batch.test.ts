import { expect, it } from "vitest";
import { mapToolCalls } from "./tool-batch";

it("overlaps at most three independent calls and retains model order", async () => {
  let active = 0;
  let peak = 0;
  const releases: (() => void)[] = [];
  const calls = [0, 1, 2, 3, 4, 5];
  const result = mapToolCalls(
    calls,
    () => true,
    async (value) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => {
        releases[value] = resolve;
      });
      active--;
      return value;
    },
  );
  expect(active).toBe(3);
  releases[2]();
  releases[0]();
  releases[1]();
  await new Promise((resolve) => setTimeout(resolve, 0));
  releases[5]();
  releases[3]();
  releases[4]();
  expect(await result).toEqual(calls);
  expect(peak).toBe(3);
});

it("waits at dependencies and display/mutation barriers", async () => {
  let known = false;
  const events: string[] = [];
  const result = await mapToolCalls(
    ["search", "dependentRead", "display"],
    (call) => call === "search" || (call === "dependentRead" && known),
    async (call) => {
      if (call === "dependentRead") expect(known).toBe(true);
      if (call === "search") {
        await Promise.resolve();
        known = true;
      }
      events.push(call);
      return call;
    },
  );
  expect(events).toEqual(result);
  expect(events).toEqual(["search", "dependentRead", "display"]);
});

it("does not launch queued work after cancellation", async () => {
  const controller = new AbortController();
  const started: number[] = [];
  await expect(
    mapToolCalls(
      [0, 1, 2, 3, 4],
      () => true,
      async (value) => {
        started.push(value);
        if (value === 0) controller.abort();
        return value;
      },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(started).toEqual([0]);
});
