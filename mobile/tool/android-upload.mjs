import { createReadStream, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { compareVersions } from "./android-version.mjs";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const manifest = JSON.parse(readFileSync("release/android-update.json", "utf8"));
const endpoint = required("ANDROID_STORAGE_ENDPOINT");
const base = required("ANDROID_DOWNLOAD_BASE_URL").replace(/\/$/, "");
if (new URL(endpoint).protocol !== "https:" || new URL(base).protocol !== "https:")
  throw new Error("Storage URLs must use HTTPS");
const bucket = required("ANDROID_STORAGE_BUCKET");
const client = new S3Client({
  endpoint,
  region: process.env.ANDROID_STORAGE_REGION || "auto",
  credentials: {
    accessKeyId: required("ANDROID_STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: required("ANDROID_STORAGE_SECRET_ACCESS_KEY"),
  },
});
if (process.argv[2] === "sync") {
  const repo = required("GITHUB_REPOSITORY");
  const releases = JSON.parse(
    execFileSync("gh", ["api", `repos/${repo}/releases?per_page=100`, "--paginate", "--slurp"], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }),
  )
    .flat()
    .filter((r) => !r.draft && !r.prerelease && /^android-v\d+\.\d+\.\d+$/.test(r.tag_name));
  if (releases.some((r) => compareVersions(r.tag_name.slice(9), manifest.versionName) > 0)) {
    console.log("A newer GitHub release exists; leaving its snapshot unchanged");
    client.destroy();
    process.exit(0);
  }
  const release = JSON.parse(
    execFileSync("gh", ["api", `repos/${repo}/releases/tags/android-v${manifest.versionName}`], {
      encoding: "utf8",
    }),
  );
  if (release.draft || release.prerelease || !release.published_at)
    throw new Error("Cannot mirror an unpublished release");
  const raw = release.body?.match(/<!-- markai-android-update\s*([\s\S]*?)\s*-->/)?.[1];
  const published = JSON.parse(raw || "{}");
  if (published.sha256 !== manifest.sha256 || published.versionCode !== manifest.versionCode)
    throw new Error("GitHub release does not match uploaded manifest");
  const snapshot = JSON.stringify({
    ...published,
    repository: repo,
    published: true,
    publishedAt: release.published_at,
    releaseNotes: release.body.replace(/<!-- markai-android-update[\s\S]*?-->/g, "").trim(),
  });
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "android/latest.json",
      Body: snapshot,
      ContentType: "application/json",
      CacheControl: "public, max-age=60",
    }),
  );
  console.log("Published GitHub release snapshot synchronized");
  client.destroy();
  process.exit(0);
}
const files = [`MarkAI-${manifest.versionName}.apk`, "android-update.json", "SHA256SUMS"];
for (const name of files) {
  const path = `release/${name}`,
    key = `android/${manifest.versionName}/${name}`;
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  const sha256 = hash.digest("hex"),
    size = statSync(path).size;
  let existing;
  try {
    existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
  }
  if (existing && (existing.Metadata?.sha256 !== sha256 || existing.ContentLength !== size)) {
    throw new Error(`Refusing to overwrite different bytes at ${key}. Use a new version.`);
  }
  if (!existing)
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(path),
        ContentLength: size,
        IfNoneMatch: "*",
        Metadata: { sha256 },
        CacheControl: "public, max-age=31536000, immutable",
        ContentType: name.endsWith(".apk")
          ? "application/vnd.android.package-archive"
          : name.endsWith(".json")
            ? "application/json"
            : "text/plain",
      }),
    );
  // Verify the exact public route users will download from, not just storage credentials.
  const response = await fetch(`${base}/${key}`, {
    signal: AbortSignal.timeout(180000),
    cache: "no-store",
  });
  if (!response.ok || !response.body)
    throw new Error(`Public download unavailable for ${key}: ${response.status}`);
  const publicHash = createHash("sha256");
  let received = 0;
  for await (const bytes of response.body) {
    received += bytes.length;
    publicHash.update(bytes);
  }
  if (received !== size || publicHash.digest("hex") !== sha256)
    throw new Error(`Public download verification failed for ${key}`);
  console.log(`Uploaded and verified ${key} (${size} bytes)`);
}
client.destroy();
