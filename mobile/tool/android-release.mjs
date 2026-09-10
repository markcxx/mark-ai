import { readFileSync, writeFileSync, appendFileSync, statSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { versionCode, compareVersions } from "./android-version.mjs";

const name = process.env.VERSION_NAME;
const code = versionCode(name);
const tag = `android-v${name}`;
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const repo = process.env.GITHUB_REPOSITORY;
const compare = compareVersions;

if (process.argv[2] === "validate") {
  const releases = JSON.parse(
    gh("api", `repos/${repo}/releases?per_page=100`, "--paginate", "--slurp"),
  ).flat();
  if (releases.some((r) => r.tag_name === tag))
    throw new Error(
      "This version already exists, including drafts. Choose a new version or remove the failed draft before retrying.",
    );
  const refs = JSON.parse(gh("api", `repos/${repo}/git/matching-refs/tags/${tag}`));
  if (refs.some((ref) => ref.ref === `refs/tags/${tag}`))
    throw new Error(
      "This tag already exists. Use a new version to bind the release to the selected commit.",
    );
  const local = readFileSync("mobile/pubspec.yaml", "utf8").match(
    /^version: (\d+\.\d+\.\d+)(?:\+(\d+))?/m,
  );
  if (!local || compare(name, local[1]) < 0 || code < Number(local[2] || 0))
    throw new Error("Version must not be older than pubspec.yaml.");
  for (const release of releases.filter(
    (r) => !r.draft && !r.prerelease && /^android-v\d+\.\d+\.\d+$/.test(r.tag_name),
  )) {
    if (compare(name, release.tag_name.slice(9)) <= 0)
      throw new Error("Version name must increase beyond every published Android release.");
    const asset = release.assets.find((a) => a.name === "android-update.json");
    if (!asset)
      throw new Error(
        "Published Android release is missing its manifest. Repair it before publishing another version.",
      );
    const manifest = JSON.parse(
      gh(
        "api",
        `repos/${repo}/releases/assets/${asset.id}`,
        "-H",
        "Accept: application/octet-stream",
      ),
    );
    if (!Number.isSafeInteger(manifest.versionCode) || code <= manifest.versionCode)
      throw new Error("Version code must increase beyond every published Android release.");
  }
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `VERSION_CODE=${code}\n`);
} else if (process.argv[2] === "manifest") {
  const apk = `release/MarkAI-${name}.apk`;
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(apk)) hash.update(chunk);
  const sha256 = hash.digest("hex");
  const mirrorBase = process.env.ANDROID_DOWNLOAD_BASE_URL?.replace(/\/$/, "");
  if (!mirrorBase || new URL(mirrorBase).protocol !== "https:")
    throw new Error("Configure ANDROID_DOWNLOAD_BASE_URL as HTTPS");
  const manifest = {
    versionName: name,
    versionCode: code,
    packageName: "com.markai.markai_mobile",
    minSdk: 24,
    size: statSync(apk).size,
    sha256,
    downloads: [
      { id: "mirror", label: "加速下载", url: `${mirrorBase}/android/${name}/MarkAI-${name}.apk` },
      {
        id: "github",
        label: "GitHub",
        url: `https://github.com/${repo}/releases/download/${tag}/MarkAI-${name}.apk`,
      },
    ],
  };
  writeFileSync("release/android-update.json", JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync("release/SHA256SUMS", `${sha256}  MarkAI-${name}.apk\n`);
  writeFileSync(
    "release/notes.md",
    (process.env.RELEASE_NOTES?.trim() || "修复问题并改善使用体验。") +
      `\n\n<!-- markai-android-update\n${JSON.stringify(manifest)}\n-->\n`,
  );
} else {
  throw new Error("Expected validate or manifest");
}
