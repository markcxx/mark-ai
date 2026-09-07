"use client";

import { useFileUrl } from "../FileAccessContext";
import type { GeneratedImageState } from "@/lib/chat/types";

export function GeneratedImageBlock({
  generatedImage,
  onPreview,
}: {
  generatedImage: GeneratedImageState;
  onPreview: (file: GeneratedImageState["file"]) => void;
}) {
  const { file } = generatedImage;
  const fileUrl = useFileUrl();

  return (
    <button
      aria-label={`预览 ${file.name}`}
      className="my-2 block w-fit max-w-full overflow-hidden rounded-xl text-left"
      onClick={() => onPreview(file)}
      type="button"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={generatedImage.revisedPrompt || generatedImage.prompt || file.name}
        className="block h-auto max-h-[72dvh] max-w-full object-contain transition-transform duration-300 hover:scale-[1.01]"
        src={fileUrl(file.id, "preview")}
      />
    </button>
  );
}
