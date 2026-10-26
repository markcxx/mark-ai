"use client";

import { Image as ImageIcon } from "lucide-react";

export function ImageGenerationSkeleton({ label = "正在生成图片" }: { label?: string }) {
  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
      <div
        aria-label={label}
        aria-live="polite"
        className="image-generation-skeleton aspect-square overflow-hidden"
        role="status"
      >
        <span aria-hidden="true" className="image-generation-skeleton-icon">
          <ImageIcon size={36} strokeWidth={1.25} />
        </span>
      </div>
    </div>
  );
}
