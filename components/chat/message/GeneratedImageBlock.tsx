"use client";

import AppImage from "@/components/ui/AppImage";
import { useFileUrl } from "../FileAccessContext";
import type { GeneratedImageState } from "@/lib/chat/types";

type GeneratedImageBlockProps = {
  generatedImage: GeneratedImageState;
  onPreview: (file: GeneratedImageState["file"]) => void;
};

export function GeneratedImageBlock({ generatedImage, onPreview }: GeneratedImageBlockProps) {
  const fileUrl = useFileUrl();
  const { file } = generatedImage;
  return (
    <AppImage
      native
      src={fileUrl(file.id, "preview")}
      alt={generatedImage.revisedPrompt || generatedImage.prompt || file.name}
      loading="eager"
      loadingLabel="图片已生成，正在加载"
      placeholderAspectRatio="1"
      previewLabel={`预览 ${file.name}`}
      onPreview={() => onPreview(file)}
      containerClassName="my-2 w-fit overflow-hidden rounded-xl data-[image-state=loading]:max-w-[400px] data-[image-state=error]:max-w-[400px]"
      className="h-auto max-h-[72dvh] object-contain"
    />
  );
}
