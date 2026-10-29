/** A timeout belongs to one retrieval operation, not each key in its key pool. */
export function retrievalSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  parent?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  const timer = setTimeout(
    () => controller.abort(new DOMException("网页服务响应超时，请换一个来源重试", "TimeoutError")),
    timeoutMs,
  );
  parent?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}

const unavailableKeys = new Map<string, number>();

export async function fetchRetrievalJson(
  endpoint: string,
  keys: string[],
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  // Do not retry malformed requests or a slow/unhealthy service against every key.
  // Remember auth/quota failures across pages so each page doesn't pay for them again.
  const now = Date.now();
  for (const [key, expiry] of unavailableKeys) if (expiry <= now) unavailableKeys.delete(key);
  const available = keys.filter((key) => !unavailableKeys.has(`${new URL(endpoint).host}:${key}`));
  let status = 503;
  for (const key of available) {
    signal.throwIfAborted();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (response.ok) return response.json();
    status = response.status;
    await response.body?.cancel();
    if (![401, 402, 403, 429, 432, 433].includes(status)) break;
    unavailableKeys.set(
      `${new URL(endpoint).host}:${key}`,
      now + (status === 429 ? 60_000 : 300_000),
    );
  }
  throw Object.assign(new Error(`联网服务暂时不可用（HTTP ${status}），请稍后重试或更换来源`), {
    status,
  });
}

/** Hedge a slow primary; only callers' validated results may win. */
export function firstUsable<T>(
  primary: (signal: AbortSignal) => Promise<T>,
  secondary: ((signal: AbortSignal) => Promise<T>) | undefined,
  signal: AbortSignal,
  delayMs = 1200,
): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let finished = false;
    let secondaryStarted = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: T | undefined, error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      controller.abort();
      if (error !== undefined) reject(error);
      else resolve(value as T);
    };
    const abort = () => finish(undefined, signal.reason);
    const run = (task: (signal: AbortSignal) => Promise<T>) => {
      Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted();
          return task(controller.signal);
        })
        .then(
          (value) => finish(value),
          (error) => {
            if (finished) return;
            failures++;
            if (!secondary || failures === 2) finish(undefined, error);
            else startSecondary();
          },
        );
    };
    const startSecondary = () => {
      if (secondaryStarted || finished || !secondary) return;
      secondaryStarted = true;
      clearTimeout(timer);
      run(secondary);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (secondary) timer = setTimeout(startSecondary, delayMs);
    run(primary);
  });
}
