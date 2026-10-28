/** Durations only: never include prompts, credentials or user identifiers. */
export function createRequestTiming() {
  const started = performance.now();
  const durations = new Map<string, number>();
  return {
    async measure<T>(name: string, work: () => T | Promise<T>): Promise<T> {
      const start = performance.now();
      try {
        return await work();
      } finally {
        durations.set(name, performance.now() - start);
      }
    },
    response(response: Response) {
      durations.set("prepare", performance.now() - started);
      response.headers.set(
        "Server-Timing",
        [...durations].map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(", "),
      );
      return response;
    },
  };
}
