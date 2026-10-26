"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff } from "lucide-react";
import type { WebImage } from "@/lib/chat/types";
import { publicResourceUrl } from "@/lib/search/web-assets";
import { AppDialog } from "@/components/ui/AppDialog";
import { IconButton } from "@/components/ui/IconButton";

function ImageTile({
  image,
  index,
  onOpen,
}: {
  image: WebImage;
  index: number;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.025]">
      <button
        aria-label={`查看图片 ${index + 1}：${image.title}`}
        className="relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden bg-gray-100 dark:bg-white/5"
        onClick={onOpen}
        type="button"
      >
        {failed ? (
          <span className="flex items-center gap-2 px-3 text-xs text-gray-500">
            <ImageOff aria-hidden="true" size={18} />
            图片暂不可用，点击查看来源
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- Public web image hosts are dynamic.
          <img
            alt={image.description || image.title}
            className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
            loading="lazy"
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
            src={image.url}
          />
        )}
      </button>
    </figure>
  );
}

/** Display only selected, persisted web assets, never model-authored URLs. */
export function WebImageGallery({ images }: { images: WebImage[] }) {
  const safeImages = (Array.isArray(images) ? images : [])
    .flatMap((image) => {
      if (!image || typeof image !== "object") return [];
      const url = publicResourceUrl(image.url);
      return url ? [{ ...image, url }] : [];
    })
    .slice(0, 6);
  const [active, setActive] = useState<number | null>(null);
  const selected = active === null ? undefined : safeImages[active];
  if (!safeImages.length) return null;
  return (
    <section aria-label="网页图片" className="my-3 min-w-0">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {safeImages.map((image, index) => (
          <ImageTile image={image} index={index} key={image.id} onOpen={() => setActive(index)} />
        ))}
      </div>
      <AppDialog
        bodyClassName="p-3"
        onClose={() => setActive(null)}
        open={Boolean(selected)}
        title={<span className="block truncate">{selected?.title || "网页图片"}</span>}
        width={960}
      >
        {selected && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- Public web image hosts are dynamic. */}
            <img
              alt={selected.description || selected.title}
              className="mx-auto max-h-[65dvh] max-w-full object-contain"
              referrerPolicy="no-referrer"
              src={selected.url}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <IconButton
                aria-label="上一张图片"
                data-markai-tooltip="上一张"
                disabled={active === 0}
                onClick={() => setActive((value) => Math.max(0, (value || 0) - 1))}
              >
                <ChevronLeft size={18} />
              </IconButton>
              <a
                className="inline-flex min-h-10 min-w-0 items-center gap-1 text-xs text-primary hover:underline"
                href={publicResourceUrl(selected.sourceUrl) || selected.url}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="shrink-0" size={13} />
                <span className="truncate">
                  打开来源 · {(active || 0) + 1}/{safeImages.length}
                </span>
              </a>
              <IconButton
                aria-label="下一张图片"
                data-markai-tooltip="下一张"
                disabled={active === safeImages.length - 1}
                onClick={() =>
                  setActive((value) => Math.min(safeImages.length - 1, (value || 0) + 1))
                }
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </>
        )}
      </AppDialog>
    </section>
  );
}
