// Single source for the site's own address. Configure APP_URL only;
// NEXT_PUBLIC_APP_URL is read as a legacy fallback for older deployments.

/** Configured app origin without a trailing slash, or undefined when unset/invalid. */
export function getAppUrl(): string | undefined {
  const value = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * Same-origin guard for state-changing requests: allows requests without an
 * Origin header, the request's own origin and the configured app origin.
 */
export function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set([new URL(request.url).origin]);
  const appUrl = getAppUrl();
  if (appUrl) allowed.add(appUrl);
  return allowed.has(origin);
}
