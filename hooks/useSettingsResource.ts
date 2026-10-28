"use client";
import { useEffect, useState } from "react";

/** Settings-only resources are loaded on entry and cancelled when leaving a page. */
export function useSettingsResource<T>(url: string) {
  const [state, setState] = useState<{ url: string; data?: T; error?: string }>({ url });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ url });
    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "加载失败，请重试");
        return body as T;
      })
      .then((data) => {
        if (!controller.signal.aborted) setState({ url, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ url, error: error instanceof Error ? error.message : "加载失败，请重试" });
      });
    return () => controller.abort();
  }, [url, attempt]);
  const current = state.url === url ? state : { url };
  return {
    ...current,
    retry: () => setAttempt((value) => value + 1),
    loading: !current.data && !current.error,
  };
}
