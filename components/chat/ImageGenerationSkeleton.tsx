"use client";

import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

const SLOW_GENERATION_NOTICE_DELAY = 12_000;

export function ImageGenerationSkeleton() {
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowSlowNotice(true), SLOW_GENERATION_NOTICE_DELAY);
    return () => window.clearTimeout(timeout);
  }, []);

  const statusText = showSlowNotice ? "图片生成通常需要较长时间，请耐心等待" : "正在构思画面…";

  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-black/[0.08] bg-[var(--chat-panel-bg)] p-px shadow-sm dark:border-white/10">
      <div
        aria-label={statusText}
        aria-live="polite"
        className="image-generation-skeleton aspect-square overflow-hidden rounded-[11px]"
        role="status"
      >
        <span aria-hidden="true" className="image-generation-skeleton-glow" />
        <span aria-hidden="true" className="image-generation-skeleton-icon">
          <ImageIcon size={30} strokeWidth={1.7} />
        </span>
        <span className="image-generation-skeleton-label">{statusText}</span>
      </div>
    </div>
  );
}
