import { normalizeWebImageUrl } from "../chat/web-image-url";
import { fetchPublicImage } from "../server/public-image-fetch";

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

/** Fetch public raster images without forwarding browser cookies or credentials. */
export async function fetchWebImage(raw: string, signal: AbortSignal, sourceUrl?: string) {
  const initialUrl = normalizeWebImageUrl(raw);
  if (!initialUrl) throw new Error("图片地址不受支持");
  let url: string = initialUrl;
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetchPublicImage(url, {
      signal: bounded,
      redirect: "manual",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
        ...(normalizeWebImageUrl(sourceUrl) ? { Referer: `${new URL(sourceUrl!).origin}/` } : {}),
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      const next: string | undefined | null =
        location && normalizeWebImageUrl(new URL(location, url).toString());
      if (!next) throw new Error("图片重定向地址不受支持");
      url = next;
      continue;
    }
    const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    if (
      !response.ok ||
      !IMAGE_TYPES.has(type) ||
      !response.body ||
      Number(response.headers.get("content-length")) > MAX_BYTES
    ) {
      await response.body?.cancel();
      throw new Error("来源图片暂时无法加载");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) throw new Error("来源图片过大");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!size) throw new Error("来源图片为空");
    return { bytes: Buffer.concat(chunks), type };
  }
  throw new Error("图片重定向次数过多");
}
