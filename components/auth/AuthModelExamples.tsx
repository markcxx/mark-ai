"use client";

import { useEffect, useState } from "react";

export function AuthModelExamples() {
  const [content, setContent] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/public/announcement?scope=auth-models", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const { announcement } = await response.json();
        if (!controller.signal.aborted) setContent(announcement?.content ?? "");
      } catch {
        /* Optional showcase must not block authentication. */
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
  if (!content.trim()) return null;
  return (
    <div className="mt-6 border-t border-gray-200/70 pt-4 dark:border-white/10">
      <p className="text-[11px] text-gray-400">探索前沿模型</p>
      <p className="mt-2 whitespace-pre-wrap break-words font-jakarta text-xs leading-7 text-gray-500 dark:text-gray-400 [overflow-wrap:anywhere]">
        {content}
      </p>
      <p className="mt-2 text-[11px] text-gray-400">具体可用模型以站内模型列表为准</p>
    </div>
  );
}
