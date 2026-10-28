import { expect, it, vi } from "vitest";
import { observeImageLoading } from "./image-loading";
class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  currentSrc = "https://example.com/a.jpg";
  getAttribute() {
    return this.currentSrc;
  }
  decode = vi.fn(async () => {});
}
it("shows loading until a fetched image has decoded", async () => {
  const image = new FakeImage();
  let finish!: () => void;
  image.decode.mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const update = vi.fn();
  const stop = observeImageLoading(image as unknown as HTMLImageElement, update);
  image.naturalWidth = 100;
  image.dispatchEvent(new Event("load"));
  expect(update.mock.calls.flat()).toEqual(["loading"]);
  finish();
  await Promise.resolve();
  expect(update).toHaveBeenLastCalledWith("ready");
  stop();
});
it("recognizes a cached image whose load event already fired", async () => {
  const image = new FakeImage();
  image.complete = true;
  image.naturalWidth = 40;
  const update = vi.fn();
  const stop = observeImageLoading(image as unknown as HTMLImageElement, update);
  await Promise.resolve();
  expect(update).toHaveBeenLastCalledWith("ready");
  stop();
});
it("ignores stale decodes after the source is replaced or the component unmounts", async () => {
  const image = new FakeImage();
  let finish!: () => void;
  image.decode.mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const update = vi.fn();
  const stop = observeImageLoading(image as unknown as HTMLImageElement, update);
  image.naturalWidth = 100;
  image.dispatchEvent(new Event("load"));
  stop();
  finish();
  await Promise.resolve();
  expect(update.mock.calls.flat()).toEqual(["loading"]);
});
it("keeps a later network error from being overwritten by an older decode", async () => {
  const image = new FakeImage();
  let finish!: () => void;
  image.decode.mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const update = vi.fn();
  const stop = observeImageLoading(image as unknown as HTMLImageElement, update);
  image.naturalWidth = 100;
  image.dispatchEvent(new Event("load"));
  image.dispatchEvent(new Event("error"));
  finish();
  await Promise.resolve();
  expect(update).toHaveBeenLastCalledWith("error");
  stop();
});
