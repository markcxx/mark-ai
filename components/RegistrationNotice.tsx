"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { isAnnouncementUrl, type AnnouncementConfig } from "@/lib/announcement-config";

export function RegistrationNoticeSurface({ announcement }: { announcement: AnnouncementConfig }) {
  if (!announcement.enabled || !announcement.content.trim()) return null;
  const hasAction =
    announcement.actionEnabled &&
    announcement.actionLabel &&
    isAnnouncementUrl(announcement.actionUrl);
  return (
    <aside
      aria-label="注册须知"
      className="mt-5 flex items-start gap-2.5 rounded-lg bg-amber-100 px-3 py-3 text-xs leading-6 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100"
    >
      <Info
        aria-hidden="true"
        size={15}
        className="mt-1 shrink-0 text-amber-600 dark:text-amber-300"
      />
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {announcement.content}
        {hasAction && (
          <>
            {" "}
            <a
              href={announcement.actionUrl}
              className="rounded-sm font-medium text-amber-900 underline decoration-amber-600/50 underline-offset-4 hover:text-amber-950 focus-visible:outline focus-visible:outline-2 dark:text-amber-200 dark:decoration-amber-300/50 dark:hover:text-amber-50"
            >
              {announcement.actionLabel}
            </a>
          </>
        )}
      </p>
    </aside>
  );
}

export function RegistrationNotice() {
  const [announcement, setAnnouncement] = useState<AnnouncementConfig | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/public/announcement?scope=registration", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) setAnnouncement(data.announcement ?? null);
      } catch {
        /* Optional notice must not interrupt registration. */
      }
    };
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return announcement ? <RegistrationNoticeSurface announcement={announcement} /> : null;
}
