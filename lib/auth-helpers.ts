import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { isCloudMode } from "@/lib/env";

export const getCurrentUserId = async (): Promise<string | undefined> => {
  if (!isCloudMode()) return undefined;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user?.id;
};

export const requireUserId = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
};
