export const CLIENT_PLATFORMS = ["web", "android", "unknown"] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];
export const CLIENT_PLATFORM_LABELS: Record<ClientPlatform, string> = {
  web: "Web",
  android: "Android",
  unknown: "未知",
};

export type UserPlatformUsage = {
  platform: ClientPlatform;
  firstSeenAt: string;
  lastSeenAt: string;
  appVersion: string | null;
};

// Client-provided metadata is for display/analytics only, never authorization.
export function identifyClient(requestHeaders: Headers) {
  const declared = requestHeaders.get("x-markai-platform")?.trim().toLowerCase();
  const agent = requestHeaders.get("user-agent") || "";
  const platform: ClientPlatform = declared
    ? declared === "android" || declared === "web"
      ? declared
      : "unknown"
    : /^Mozilla\/5\.0\b/.test(agent) && /(?:Chrome|Firefox|Safari|Edg)\//.test(agent)
      ? "web"
      : "unknown";
  const version = requestHeaders.get("x-markai-app-version")?.trim() || "";
  return {
    platform,
    appVersion:
      platform === "android" && /^\d{1,5}\.\d{1,5}\.\d{1,5}(?:\+\d{1,10})?$/.test(version)
        ? version
        : null,
  };
}
