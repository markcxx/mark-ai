"use client";

import { useState } from "react";
import AppImage from "@/components/ui/AppImage";
import type { WebImage } from "@/lib/chat/types";
import { normalizeWebImageUrl, webImageDisplayUrl } from "@/lib/chat/web-image-url";
import { FilePreviewDialog } from "../FilePreviewDialog";
import { cn } from "@/lib/utils";

function ImageTile({
  image,
  index,
  onOpen,
  single,
}: {
  image: WebImage;
  index: number;
  onOpen: () => void;
  single: boolean;
}) {
  return (
    <AppImage
      native
      src={webImageDisplayUrl(image.url, image.sourceUrl)!}
      alt={image.description || image.title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onPreview={onOpen}
      previewLabel={`查看图片 ${index + 1}`}
      containerClassName={cn(
        "w-full overflow-hidden rounded-lg",
        single ? "max-h-[440px]" : "aspect-[3/2]",
      )}
      containerStyle={single ? undefined : { aspectRatio: "3 / 2" }}
      className={
        single ? "max-h-[440px] max-w-full object-contain" : "h-full w-full object-contain"
      }
    />
  );
}

/** Display only selected, persisted web assets, never model-authored URLs. */
export function WebImageGallery({ images }: { images: WebImage[] }) {
  const safeImages = (Array.isArray(images) ? images : [])
    .flatMap((image) => {
      if (!image || typeof image !== "object") return [];
      const url = normalizeWebImageUrl(image.url);
      return url ? [{ ...image, url }] : [];
    })
    .slice(0, 6);
  const [active, setActive] = useState<number | null>(null);
  const selected = active === null ? undefined : safeImages[active];
  if (!safeImages.length) return null;
  return (
    <section aria-label="网页图片" className="my-3 min-w-0">
      <div
        className={cn(
          "grid gap-2",
          safeImages.length === 1
            ? "grid-cols-1"
            : safeImages.length === 2
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {safeImages.map((image, index) => (
          <ImageTile
            image={image}
            index={index}
            key={image.id}
            onOpen={() => setActive(index)}
            single={safeImages.length === 1}
          />
        ))}
      </div>
      <FilePreviewDialog
        file={
          selected
            ? { id: selected.id, name: selected.title, contentType: "image/*", size: 0 }
            : null
        }
        previewUrl={selected && webImageDisplayUrl(selected.url, selected.sourceUrl)}
        downloadUrl={selected && webImageDisplayUrl(selected.url, selected.sourceUrl)}
        showImageDetails={false}
        onClose={() => setActive(null)}
      />
    </section>
  );
}
