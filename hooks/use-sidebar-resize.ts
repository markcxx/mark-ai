import type { PointerEvent as ReactPointerEvent } from "react";

import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

export const useSidebarResize = (sidebarWidth: number) => {
  return (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    useUIStore.getState().setIsResizingSidebar(true);
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      useUIStore.getState().setSidebarWidth(startWidth + pointerEvent.clientX - startX);
    };
    const handlePointerUp = () => {
      useUIStore.getState().setIsResizingSidebar(false);
      useSettingsStore.getState().updateGeneral({
        sidebarWidth: useUIStore.getState().sidebarWidth,
      });
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
};
