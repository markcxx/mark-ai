import { afterEach, expect, it, vi } from "vitest";
import { createFirstResponseTiming } from "./first-response-timing";
afterEach(() => vi.restoreAllMocks());
it("measures click-to-first-text including preflight and excludes loading-only updates", () => {
  const now = vi.spyOn(performance, "now");
  now.mockReturnValue(100);
  const measure = vi.spyOn(performance, "measure");
  const timing = createFirstResponseTiming(0);
  timing.request();
  now.mockReturnValue(300);
  timing.headers(new Response(null, { headers: { "Server-Timing": "auth;dur=10" } }));
  timing.committed();
  expect(measure).not.toHaveBeenCalled();
  now.mockReturnValue(900);
  timing.text();
  now.mockReturnValue(901);
  timing.committed();
  timing.committed();
  expect(measure).toHaveBeenCalledTimes(1);
  expect(measure).toHaveBeenCalledWith("markai:chat:first-visible", {
    start: 0,
    end: 901,
    detail: {
      totalMs: 901,
      beforeRequestMs: 100,
      requestToHeadersMs: 200,
      headersToFirstTextMs: 600,
      firstTextToStateMs: 1,
      serverTiming: "auth;dur=10",
    },
  });
});
