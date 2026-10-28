const writes = new Map<string, Promise<unknown>>();

/** Older completions must never land after a newer turn's save. */
export function enqueueSessionWrite<T>(id: string, write: () => Promise<T>): Promise<T> {
  const previous = writes.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(write);
  writes.set(id, next);
  void next
    .finally(() => {
      if (writes.get(id) === next) writes.delete(id);
    })
    .catch(() => undefined);
  return next;
}
