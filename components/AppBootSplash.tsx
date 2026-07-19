"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { MarkAILoadingScreen } from "./MarkAILoadingScreen";

const ROUTES_WITHOUT_CHAT_INITIALIZATION = [
  "/admin",
  "/login",
  "/onboarding",
  "/plugins",
  "/register",
  "/reset-password",
];

export function AppBootSplash() {
  const pathname = usePathname();
  const isAppReady = useUIStore((s) => s.isAppReady);
  const bootMessage = useUIStore((s) => s.bootMessage);
  const bootProgress = useUIStore((s) => s.bootProgress);
  const [minimumDurationElapsed, setMinimumDurationElapsed] = useState(false);
  const [visible, setVisible] = useState(true);
  const requiresChatInitialization = !ROUTES_WITHOUT_CHAT_INITIALIZATION.some((path) =>
    pathname.startsWith(path),
  );
  const routeReady = !requiresChatInitialization || isAppReady;
  const exiting = minimumDurationElapsed && routeReady;

  useEffect(() => {
    if (requiresChatInitialization && !useUIStore.getState().isAppReady) {
      setVisible(true);
    }
    setMinimumDurationElapsed(false);
    const timer = window.setTimeout(() => setMinimumDurationElapsed(true), 120);
    return () => window.clearTimeout(timer);
  }, [pathname, requiresChatInitialization]);

  useEffect(() => {
    if (!exiting) return;

    const timer = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  if (!visible) return null;

  return (
    <MarkAILoadingScreen
      className={cn(
        "fixed inset-0 z-[9999] transition-opacity duration-200",
        exiting && "opacity-0",
      )}
      progress={requiresChatInitialization ? bootProgress : 100}
      status={requiresChatInitialization ? bootMessage : "正在准备页面…"}
    />
  );
}
