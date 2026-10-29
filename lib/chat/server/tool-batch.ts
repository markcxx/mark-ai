/** Read-only calls may overlap. Mutations, displays and dependent reads are barriers. */
export async function mapToolCalls<T, R>(
  calls: T[],
  independent: (call: T) => boolean,
  execute: (call: T, index: number) => Promise<R>,
  signal?: AbortSignal,
) {
  const results: R[] = new Array(calls.length);
  let index = 0;
  while (index < calls.length) {
    signal?.throwIfAborted();
    if (!independent(calls[index])) {
      results[index] = await execute(calls[index], index);
      index++;
      continue;
    }
    const start = index;
    while (index < calls.length && independent(calls[index])) index++;
    const end = index;
    let cursor = start;
    let failed = false;
    const workers = Array.from({ length: Math.min(3, end - start) }, async () => {
      while (cursor < end && !failed) {
        signal?.throwIfAborted();
        const current = cursor++;
        try {
          results[current] = await execute(calls[current], current);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    });
    // Settle active work before allowing the stream to close on cancellation/error.
    const settled = await Promise.allSettled(workers);
    const failure = settled.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
  return results;
}
