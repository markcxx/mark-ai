export type ImageLoadStatus = "loading" | "ready" | "error";

/** Shared by native and optimized images; handles cached loads and stale decodes. */
export function observeImageLoading(
  image: HTMLImageElement,
  update: (status: ImageLoadStatus) => void,
) {
  let disposed = false;
  let generation = 0;
  const loaded = async () => {
    const current = ++generation;
    try {
      await image.decode?.();
    } catch {
      /* Some browsers reject decode for otherwise valid images. */
    }
    if (!disposed && current === generation) update(image.naturalWidth > 0 ? "ready" : "error");
  };
  const failed = () => {
    generation++;
    if (!disposed) update("error");
  };
  update("loading");
  image.addEventListener("load", loaded);
  image.addEventListener("error", failed);
  if (image.complete) {
    if (image.naturalWidth > 0) void loaded();
    else if (image.currentSrc || image.getAttribute("src")) failed();
  }
  return () => {
    disposed = true;
    generation++;
    image.removeEventListener("load", loaded);
    image.removeEventListener("error", failed);
  };
}

/** Export the decoded images, never a transient skeleton from the preview UI. */
export async function waitForImageFrames(root: HTMLElement, timeoutMs = 15_000) {
  root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    image.loading = "eager";
  });
  const pending = () => Boolean(root.querySelector('[data-image-state="loading"]'));
  if (!pending()) return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      observer.disconnect();
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const observer = new MutationObserver(() => {
      if (!pending()) finish();
    });
    const timer = setTimeout(() => finish(new Error("图片仍在加载，请稍后再导出")), timeoutMs);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-image-state"],
      childList: true,
      subtree: true,
    });
    if (!pending()) finish();
  });
}
