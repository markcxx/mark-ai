import { headers } from "next/headers";

import { isActiveBan } from "@/lib/auth-access";
import { isCloudMode, isLocalMode } from "@/lib/env";
import { recordUserPlatform } from "@/lib/server/user-platforms";

export const LOCAL_STORAGE_OWNER_ID = "local";

export const getCurrentUserId = async (): Promise<string | undefined> => {
  if (!isCloudMode()) return undefined;

  const { auth } = await import("@/lib/auth");
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });

  if (!session?.user?.id) return undefined;
  if (isActiveBan(session.user)) return undefined;
  await recordUserPlatform(session.user.id, requestHeaders);
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
