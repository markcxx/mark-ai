import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAndroidRelease } from "./android-update";

const manifest = {
  versionName: "1.0.2",
  versionCode: 3,
  packageName: "com.markai.markai_mobile",
  minSdk: 24,
  size: 100,
  sha256: "a".repeat(64),
};
const release = {
  tag_name: "android-v1.0.2",
  draft: false,
  prerelease: false,
  published_at: "2026-09-10T00:00:00Z",
  body: "修复问题",
  assets: [
    { id: 12, name: "android-update.json", size: 300, state: "uploaded" },
    { id: 13, name: "MarkAI-1.0.2.apk", size: 100, state: "uploaded" },
  ],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Android releases", () => {
  it("derives a same-origin download URL instead of trusting manifest URLs", () => {
    expect(
      parseAndroidRelease(release, { ...manifest, downloadUrl: "https://untrusted.invalid" }).update
        .downloadUrl,
    ).toBe("/api/public/android-update/download?versionCode=3");
  });
  it.each([
    { packageName: "wrong" },
    { sha256: "bad" },
    { versionCode: -1 },
    { size: 101 },
    { versionName: "1.0.3" },
    { minSdk: 1 },
  ])("rejects inconsistent manifest %j", (change) => {
    expect(() => parseAndroidRelease(release, { ...manifest, ...change })).toThrow();
  });
  it("filters web/draft/prereleases, selects numeric newest and caches requests", async () => {
    const newest = {
      ...release,
      tag_name: "android-v1.0.10",
      assets: [release.assets[0], { ...release.assets[1], name: "MarkAI-1.0.10.apk" }],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([
          { ...release, tag_name: "v99.0.0" },
          { ...release, tag_name: "android-v9.0.0", draft: true },
          { ...release, tag_name: "android-v8.0.0", prerelease: true },
          release,
          newest,
        ]),
      )
      .mockResolvedValueOnce(
        Response.json({ ...manifest, versionName: "1.0.10", versionCode: 11 }),
      );
    vi.stubGlobal("fetch", fetch);
    const { latestAndroidRelease } = await import("./android-update");
    const result = await latestAndroidRelease();
    expect(result?.update.versionCode).toBe(11);
    expect(await latestAndroidRelease()).toEqual(result);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("returns no update when there are only Web releases", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json([{ ...release, tag_name: "v1.0.0" }])),
    );
    const { latestAndroidRelease } = await import("./android-update");
    expect(await latestAndroidRelease()).toBeNull();
  });
  it("does not report a network failure as latest version or cache it as success", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal("fetch", fetch);
    const { latestAndroidRelease } = await import("./android-update");
    await expect(latestAndroidRelease()).rejects.toThrow();
    expect(await latestAndroidRelease()).toBeNull();
  });
});
