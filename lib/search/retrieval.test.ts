import { afterEach, expect, it, vi } from "vitest";
import { fetchRetrievalJson, firstUsable, retrievalSignal } from "./retrieval";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("returns a fast primary without spending a backup request", async () => {
  vi.useFakeTimers();
  const backup = vi.fn();
  expect(await firstUsable(async () => "body", backup, new AbortController().signal)).toBe("body");
  await vi.runAllTimersAsync();
  expect(backup).not.toHaveBeenCalled();
});

it("hedges a slow request and aborts the loser after the first usable result", async () => {
  vi.useFakeTimers();
  let loser: AbortSignal | undefined;
  const backup = vi.fn(async () => "usable");
  const result = firstUsable(
    (signal) => {
      loser = signal;
      return new Promise<string>((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason)),
      );
    },
    backup,
    new AbortController().signal,
  );
  await vi.advanceTimersByTimeAsync(1199);
  expect(backup).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toBe("usable");
  expect(loser?.aborted).toBe(true);
});

it("does not accept a fast rejected result and starts fallback immediately", async () => {
  expect(
    await firstUsable(
      async () => {
        throw new Error("captcha");
      },
      async () => "article",
      new AbortController().signal,
    ),
  ).toBe("article");
});

it("cancels a hanging operation without launching its backup", async () => {
  const controller = new AbortController();
  const backup = vi.fn();
  const result = firstUsable(() => new Promise(() => {}), backup, controller.signal);
  const rejection = expect(result).rejects.toThrow();
  controller.abort();
  await rejection;
  expect(backup).not.toHaveBeenCalled();
});

it("bounds the whole operation even when DNS or a provider never settles", async () => {
  vi.useFakeTimers();
  const scope = retrievalSignal(undefined, 100);
  const result = firstUsable(() => new Promise(() => {}), undefined, scope.signal);
  const rejection = expect(result).rejects.toThrow("超时");
  await vi.advanceTimersByTimeAsync(100);
  await rejection;
  scope.cleanup();
  expect(vi.getTimerCount()).toBe(0);
});

it("rotates auth failures, remembers failed keys, but never retries a bad request across keys", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ ok: true }))
    .mockResolvedValueOnce(Response.json({ ok: true }))
    .mockResolvedValueOnce(new Response(null, { status: 400 }));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  const endpoint = "https://retrieval.example.com/search";
  await fetchRetrievalJson(endpoint, ["bad-key", "good-key"], {}, signal);
  await fetchRetrievalJson(endpoint, ["bad-key", "good-key"], {}, signal);
  expect(fetch.mock.calls[2][1].headers.Authorization).toBe("Bearer good-key");
  await expect(
    fetchRetrievalJson(endpoint, ["other-a", "other-b"], {}, signal),
  ).rejects.toMatchObject({ status: 400 });
  expect(fetch).toHaveBeenCalledTimes(4);
});

it("does not expose response bodies that could echo credentials", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("secret credential", { status: 500 })),
  );
  await expect(
    fetchRetrievalJson(
      "https://retrieval.example.com/read",
      ["secret"],
      {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("HTTP 500");
});
