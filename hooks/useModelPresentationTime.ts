"use client";

import { useEffect, useState } from "react";
import type { ConfiguredModel } from "@/lib/chat/types";

/** Re-evaluate scheduled launches even when the page remains open overnight. */
export function useModelPresentationTime(models: ConfiguredModel[]) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [models]);
  useEffect(() => {
    const upcoming = models
      .map((model) => Date.parse(model.presentation?.newUntil ?? ""))
      .filter((time) => time > now);
    if (!upcoming.length) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.min(...upcoming) - now + 1, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [models, now]);
  return now;
}
