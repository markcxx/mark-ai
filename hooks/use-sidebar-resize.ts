import type { PointerEvent as ReactPointerEvent } from "react";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { SIDEBAR_MIN_WIDTH, useUIStore } from "@/stores/useUIStore";

const SIDEBAR_COLLAPSE_OVERDRAG = 56;

export const useSidebarResize = (sidebarWidth: number) => {
  return (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    useUIStore.getState().setIsResizingSidebar(true);
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let finished = false;

    const cleanup = () => {
      window.removeEventListener("blur", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    const finishResize = (collapse = false) => {
      if (finished) return;
      finished = true;

      const currentWidth = useUIStore.getState().sidebarWidth;
      useUIStore.setState({
        isResizingSidebar: false,
        ...(collapse ? { isSidebarOpen: false, sidebarWidth: startWidth } : {}),
      });
      useSettingsStore.getState().updateGeneral({
        sidebarWidth: collapse ? startWidth : currentWidth,
      });
      cleanup();
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      const nextWidth = startWidth + pointerEvent.clientX - startX;
      if (nextWidth <= SIDEBAR_MIN_WIDTH - SIDEBAR_COLLAPSE_OVERDRAG) {
        finishResize(true);
        return;
      }
      useUIStore.getState().setSidebarWidth(nextWidth);
    };
    const handlePointerUp = () => {
      finishResize();
    };

    window.addEventListener("blur", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
};
