import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

const PREVIEW_MIN_WIDTH = 30;
const PREVIEW_CLOSE_OVERDRAG = 8;

export const usePreviewResize = (
  containerRef: RefObject<HTMLDivElement | null>,
  previewWidth: number,
  onClose: () => void,
) => {
  return (event: ReactPointerEvent<HTMLDivElement>) => {
    const containerWidth = containerRef.current?.getBoundingClientRect().width || 0;
    if (!containerWidth) return;
    event.preventDefault();

    useUIStore.getState().setIsResizingPreview(true);
    const startX = event.clientX;
    const startWidth = previewWidth;
    let finished = false;

    const cleanup = () => {
      window.removeEventListener("blur", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    const finishResize = (close = false) => {
      if (finished) return;
      finished = true;
      const currentWidth = useUIStore.getState().previewWidth;
      useUIStore.setState({
        isResizingPreview: false,
        ...(close ? { previewWidth: startWidth } : {}),
      });
      useSettingsStore.getState().updateGeneral({
        previewWidth: close ? startWidth : currentWidth,
      });
      cleanup();
      if (close) onClose();
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      const deltaPercent = ((startX - pointerEvent.clientX) / containerWidth) * 100;
      const nextWidth = startWidth + deltaPercent;
      if (nextWidth <= PREVIEW_MIN_WIDTH - PREVIEW_CLOSE_OVERDRAG) {
        finishResize(true);
        return;
      }
      useUIStore.getState().setPreviewWidth(nextWidth);
    };

    const handlePointerUp = () => finishResize();
    window.addEventListener("blur", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
};
