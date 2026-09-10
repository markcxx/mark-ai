"use client";

import { useCallback, useEffect, useState } from "react";
import { AnnouncementSurface } from "./AnnouncementSurface";
import type { AnnouncementConfig } from "@/lib/announcement-config";

type Announcement = AnnouncementConfig & { revision: string };
const DISMISSED_KEY = "markai:announcement-dismissed";

export function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState("");
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/public/announcement", { cache: "no-store", signal });
      if (response.ok) {
        const data = await response.json();
        setAnnouncement(data.announcement ?? null);
      }
    } catch {
      /* Announcements never block the workspace. */
    }
  }, []);
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(DISMISSED_KEY) || sessionStorage.getItem(DISMISSED_KEY) || "";
      setDismissed(saved);
      if (saved) localStorage.setItem(DISMISSED_KEY, saved);
    } catch {}
    const syncDismissed = (event: StorageEvent) => {
      if (event.key === DISMISSED_KEY || event.key === null) {
        try {
          setDismissed(localStorage.getItem(DISMISSED_KEY) || "");
        } catch {}
      }
    };
    window.addEventListener("storage", syncDismissed);
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => {
      if (!document.hidden) void load(controller.signal);
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("storage", syncDismissed);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  if (
    !announcement?.enabled ||
    !announcement.content ||
    (announcement.closable && dismissed === announcement.revision)
  )
    return null;
  return (
    <AnnouncementSurface
      announcement={announcement}
      onClose={() => {
        setDismissed(announcement.revision);
        try {
          localStorage.setItem(DISMISSED_KEY, announcement.revision);
        } catch {}
      }}
    />
  );
}
