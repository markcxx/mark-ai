import { headers } from "next/headers";

import { isActiveBan } from "@/lib/auth-access";
import { isCloudMode, isLocalMode } from "@/lib/env";

export const LOCAL_STORAGE_OWNER_ID = "local";

export const getCurrentUserId = async (): Promise<string | undefined> => {
  if (!isCloudMode()) return undefined;

  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (!session?.user?.id) return undefined;
  if (isActiveBan(session.user)) return undefined;
  return session.user.id;
};

export const requireUserId = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
};

export const getCurrentStorageOwnerId = async (): Promise<string | undefined> => {
  if (isLocalMode()) return LOCAL_STORAGE_OWNER_ID;
  return getCurrentUserId();
};
