"use client";

import { ImageOff, RotateCw } from "lucide-react";
import { useRef, useState } from "react";

import { useFileUrl } from "../FileAccessContext";
import { ImageGenerationSkeleton } from "../ImageGenerationSkeleton";
import type { GeneratedImageState } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type GeneratedImageBlockProps = {
  generatedImage: GeneratedImageState;
  onPreview: (file: GeneratedImageState["file"]) => void;
};

export function GeneratedImageBlock({ generatedImage, onPreview }: GeneratedImageBlockProps) {
  const fileUrl = useFileUrl();
  const src = fileUrl(generatedImage.file.id, "preview");

  // Reset loading state when a message variant points to another generated file.
  return (
    <GeneratedImageContent
      generatedImage={generatedImage}
      key={src}
      onPreview={onPreview}
      src={src}
    />
  );
}

function GeneratedImageContent({
  generatedImage,
  onPreview,
  src,
}: GeneratedImageBlockProps & { src: string }) {
  const { file } = generatedImage;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const ready = status === "ready";

  const revealImage = async (image: HTMLImageElement) => {
    try {
      await image.decode();
      if (imageRef.current === image) setStatus("ready");
    } catch {
      if (imageRef.current === image) setStatus("error");
    }
  };

  return (
    <div className={cn("relative max-w-full", ready ? "my-2 w-fit" : "w-full max-w-[400px]")}>
      {status === "loading" && <ImageGenerationSkeleton label="图片已生成，正在加载" />}
      {status === "error" && (
        <div
          role="status"
          className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl bg-gray-100 px-5 text-center text-sm text-gray-500 dark:bg-white/5 dark:text-gray-400"
        >
          <ImageOff aria-hidden="true" size={28} strokeWidth={1.5} />
          <p>图片已生成，暂时无法加载</p>
          <button
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
            type="button"
          >
            <RotateCw aria-hidden="true" size={13} />
            重新加载图片
          </button>
        </div>
      )}
      <button
        aria-label={`预览 ${file.name}`}
        className={cn(
          "block w-fit max-w-full overflow-hidden rounded-xl text-left",
          !ready && "pointer-events-none invisible absolute inset-0",
        )}
        disabled={!ready}
        onClick={() => onPreview(file)}
        tabIndex={ready ? 0 : -1}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={generatedImage.revisedPrompt || generatedImage.prompt || file.name}
          className="block h-auto max-h-[72dvh] max-w-full object-contain transition-transform duration-300 hover:scale-[1.01]"
          decoding="async"
          key={attempt}
          loading="eager"
          onError={() => setStatus("error")}
          onLoad={(event) => void revealImage(event.currentTarget)}
          ref={imageRef}
          src={src}
        />
      </button>
    </div>
  );
}
