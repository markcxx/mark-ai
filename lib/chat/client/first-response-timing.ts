/** Measures first content/reasoning committed to message state, not loading/step events. */
export function createFirstResponseTiming(sendStartedAt = performance.now()) {
  let requestAt = sendStartedAt;
  let headersAt = sendStartedAt;
  let firstTextAt: number | undefined;
  let serverTiming: string | null = null;
  let completed = false;
  return {
    request() {
      requestAt = performance.now();
    },
    headers(response: Response) {
      headersAt = performance.now();
      serverTiming = response.headers.get("Server-Timing");
    },
    text() {
      firstTextAt ??= performance.now();
    },
    committed() {
      if (completed || firstTextAt === undefined) return;
      completed = true;
      const end = performance.now();
      const round = (n: number) => Math.round(Math.max(0, n));
      const details = {
        totalMs: round(end - sendStartedAt),
        beforeRequestMs: round(requestAt - sendStartedAt),
        requestToHeadersMs: round(headersAt - requestAt),
        headersToFirstTextMs: round(firstTextAt - headersAt),
        firstTextToStateMs: round(end - firstTextAt),
        serverTiming,
      };
      // A bounded Performance entry is available in production too; no message text or IDs.
      const name = "markai:chat:first-visible";
      try {
        performance.clearMeasures(name);
        performance.measure(name, { start: sendStartedAt, end, detail: details });
      } catch {
        /* Optional diagnostics must never interrupt output. */
      }
      if (process.env.NODE_ENV === "development") console.info("[MarkAI 首字耗时]", details);
    },
  };
}
