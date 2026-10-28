"use client";
import { useEffect, useState } from "react";
import { observeImageLoading, type ImageLoadStatus } from "@/lib/chat/client/image-loading";

export function useImageLoading() {
  const [status, setStatus] = useState<ImageLoadStatus>("loading");
  const [image, ref] = useState<HTMLImageElement | null>(null);
  useEffect(() => (image ? observeImageLoading(image, setStatus) : undefined), [image]);
  return { ref, status };
}
