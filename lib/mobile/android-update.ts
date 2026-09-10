export type AndroidUpdate = {
  versionName: string;
  versionCode: number;
  packageName: string;
  minSdk: number;
  size: number;
  sha256: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  downloads: { id: string; label: string; url: string }[];
};

type Asset = { id: number; name: string; size: number; state: string };
type Release = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  body: string | null;
  assets: Asset[];
};
type Available = { update: AndroidUpdate; assetId: number };
let cache: { expires: number; value: Available | null } | undefined;
let pending: Promise<Available | null> | undefined;

function repository() {
  const repo = process.env.MARKAI_ANDROID_RELEASE_REPOSITORY || "markcxx/mark-ai";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid release repository");
  return repo;
}

async function github(path: string, binary = false, downloadSignal?: AbortSignal) {
  const token = process.env.MARKAI_ANDROID_GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repository()}${path}`, {
    headers: {
      Accept: binary ? "application/octet-stream" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: downloadSignal
      ? AbortSignal.any([downloadSignal, AbortSignal.timeout(15 * 60_000)])
      : AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Release service returned ${response.status}`);
  return response;
}

export function parseAndroidRelease(release: Release, raw: unknown): Available {
  const m = raw as Partial<AndroidUpdate>;
  if (
    !m ||
    !Number.isSafeInteger(m.versionCode) ||
    m.versionCode! < 1 ||
    m.versionCode! > 2100000000 ||
    typeof m.versionName !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(m.versionName) ||
    release.tag_name !== `android-v${m.versionName}` ||
    m.packageName !== "com.markai.markai_mobile" ||
    !Number.isSafeInteger(m.minSdk) ||
    m.minSdk! < 24 ||
    !Number.isSafeInteger(m.size) ||
    m.size! <= 0 ||
    m.size! > 1024 ** 3 ||
    typeof m.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(m.sha256)
  ) {
    throw new Error("Invalid Android manifest");
  }
  const apk = release.assets.find(
    (a) => a.name === `MarkAI-${m.versionName}.apk` && a.state === "uploaded",
  );
  if (!apk || apk.size !== m.size) throw new Error("Missing or incomplete APK");
  return {
    assetId: apk.id,
    update: {
      versionName: m.versionName,
      versionCode: m.versionCode!,
      packageName: m.packageName,
      minSdk: m.minSdk!,
      size: m.size!,
      sha256: m.sha256,
      releaseNotes: (
        release.body?.replace(/<!-- markai-android-update[\s\S]*?-->/g, "").trim() ||
        "修复问题并改善使用体验。"
      ).slice(0, 12000),
      publishedAt: release.published_at,
      // Same-origin streaming also supports a private release repository. No GitHub token reaches the App.
      downloadUrl: `/api/public/android-update/download?versionCode=${m.versionCode}`,
      downloads: Array.isArray(m.downloads)
        ? m.downloads
            .filter((d) => {
              try {
                const u = new URL(d.url);
                return (
                  ["mirror", "github"].includes(d.id) &&
                  u.protocol === "https:" &&
                  !u.username &&
                  !u.password
                );
              } catch {
                return false;
              }
            })
            .map((d) => ({
              id: d.id,
              label: d.id === "mirror" ? "加速下载" : "GitHub",
              url: d.url,
            }))
        : [],
    },
  };
}

async function loadLatest(): Promise<Available | null> {
  const releases: Release[] = [];
  for (let page = 1; ; page++) {
    if (page > 10) throw new Error("Too many releases to inspect");
    const rows = (await (await github(`/releases?per_page=100&page=${page}`)).json()) as Release[];
    releases.push(
      ...rows.filter(
        (r) => !r.draft && !r.prerelease && /^android-v\d+\.\d+\.\d+$/.test(r.tag_name),
      ),
    );
    if (rows.length < 100) break;
  }
  // Workflow enforces increasing version names and codes. Ignore Web releases entirely.
  releases.sort((a, b) => {
    const av = a.tag_name.slice(9).split(".").map(Number);
    const bv = b.tag_name.slice(9).split(".").map(Number);
    return bv[0] - av[0] || bv[1] - av[1] || bv[2] - av[2];
  });
  if (!releases.length) return null;
  const release = releases[0];
  const embedded = release.body?.match(/<!-- markai-android-update\s*([\s\S]*?)\s*-->/)?.[1];
  if (embedded) return parseAndroidRelease(release, JSON.parse(embedded));
  const manifest = release.assets.find(
    (a) => a.name === "android-update.json" && a.state === "uploaded",
  );
  if (!manifest || manifest.size > 65536) throw new Error("Missing Android manifest");
  const response = await github(`/releases/assets/${manifest.id}`, true);
  const body = await response.text();
  if (body.length > 65536) throw new Error("Android manifest too large");
  return parseAndroidRelease(release, JSON.parse(body));
}

export async function latestAndroidRelease(): Promise<Available | null> {
  if (cache && cache.expires > Date.now()) return cache.value;
  if (!pending)
    pending = loadLatest()
      .then((value) => {
        cache = { value, expires: Date.now() + 300_000 };
        return value;
      })
      .finally(() => {
        pending = undefined;
      });
  return pending;
}

export async function downloadAndroidRelease(assetId: number, signal: AbortSignal) {
  return github(`/releases/assets/${assetId}`, true, signal);
}
