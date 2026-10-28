import { publicResourceUrl } from "../search/web-assets";

export function normalizeWebImageUrl(value: unknown): string | undefined {
  const raw = publicResourceUrl(value);
  if (!raw) return;
  const url = new URL(raw);
  if (url.port) return;
  return url.toString();
}

export function webImageDisplayUrl(url: string, sourceUrl?: string) {
  const image = normalizeWebImageUrl(url);
  if (!image) return undefined;
  const params = new URLSearchParams({ url: image });
  const source = normalizeWebImageUrl(sourceUrl);
  if (source) params.set("source", new URL(source).origin);
  return `/api/public/web-image?${params}`;
}
