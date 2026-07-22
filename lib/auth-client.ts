import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [adminClient()],
});

export type SocialProvider = "github" | "google";

export const getSocialErrorCallbackURL = (provider: SocialProvider, callbackUrl: string) => {
  const params = new URLSearchParams({ callbackUrl, provider });
  return `/api/public/oauth-error?${params.toString()}`;
};

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
