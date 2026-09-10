export const ANNOUNCEMENT_LIMIT = 1000;
export type AnnouncementConfig = {
  content: string;
  enabled: boolean;
  closable: boolean;
  actionEnabled: boolean;
  actionLabel: string;
  actionUrl: string;
};
export const DEFAULT_ANNOUNCEMENT: AnnouncementConfig = {
  content: "",
  enabled: true,
  closable: true,
  actionEnabled: false,
  actionLabel: "了解更多",
  actionUrl: "",
};

export function isAnnouncementUrl(value: string) {
  if (!value || /[\\\u0000-\u0020\u007f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseAnnouncementConfig(body: unknown): AnnouncementConfig | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  if (typeof input.content !== "string" || input.content.length > ANNOUNCEMENT_LIMIT) return null;
  for (const key of ["enabled", "closable", "actionEnabled"]) {
    if (input[key] !== undefined && typeof input[key] !== "boolean") return null;
  }
  for (const [key, limit] of [
    ["actionLabel", 24],
    ["actionUrl", 2048],
  ] as const) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length > limit))
      return null;
  }
  const config: AnnouncementConfig = {
    content: input.content.trim(),
    enabled: (input.enabled as boolean) ?? true,
    closable: (input.closable as boolean) ?? true,
    actionEnabled: (input.actionEnabled as boolean) ?? false,
    actionLabel: ((input.actionLabel as string) ?? "了解更多").trim(),
    actionUrl: ((input.actionUrl as string) ?? "").trim(),
  };
  if (config.actionUrl && !isAnnouncementUrl(config.actionUrl)) return null;
  if (config.actionEnabled && (!config.actionLabel || !config.actionUrl)) return null;
  return config;
}
