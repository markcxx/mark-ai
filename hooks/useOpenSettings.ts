"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { isGuestMode, requestGuestSignIn } from "@/lib/client/guest-mode";

export function useOpenSettings() {
  const router = useRouter();
  return useCallback(() => {
    if (isGuestMode()) return requestGuestSignIn();
    router.push("/settings");
  }, [router]);
}
