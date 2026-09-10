import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { versionCode, compareVersions } from "./android-version.mjs";

const script = resolve("mobile/tool/android-release.mjs");
function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "markai-release-"));
  try {
    mkdirSync(join(root, "mobile"));
    mkdirSync(join(root, "bin"));
    mkdirSync(join(root, "release"));
    writeFileSync(join(root, "mobile/pubspec.yaml"), "version: 1.0.2+3\n");
    writeFileSync(
      join(root, "bin/gh"),
      '#!/usr/bin/env node\nconst args = process.argv.join(" "); console.log(args.includes("matching-refs") ? process.env.FAKE_REFS || "[]" : args.includes("assets/") ? process.env.FAKE_MANIFEST || "{}" : process.env.FAKE_RELEASES || "[[]]");\n',
      { mode: 0o755 },
    );
    fn(
      (phase, extra = {}) =>
        spawnSync(process.execPath, [script, phase], {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${root}/bin:${process.env.PATH}`,
            VERSION_NAME: "1.0.2",
            ANDROID_DOWNLOAD_BASE_URL: "https://download.example.com",
            GITHUB_REPOSITORY: "test/repo",
            ...extra,
          },
        }),
      root,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("first release validates; malformed input and existing tags are rejected", () =>
  fixture((run) => {
    assert.equal(run("validate").status, 0);
    assert.notEqual(run("validate", { VERSION_NAME: "1.1000.0" }).status, 0);
    assert.notEqual(run("validate", { VERSION_NAME: "$(touch bad)" }).status, 0);
    assert.notEqual(
      run("validate", { FAKE_REFS: JSON.stringify([{ ref: "refs/tags/android-v1.0.2" }]) }).status,
      0,
    );
  }));

test("refuses to overwrite drafts and refuses decreasing version codes", () =>
  fixture((run) => {
    assert.notEqual(
      run("validate", {
        FAKE_RELEASES: JSON.stringify([[{ tag_name: "android-v1.0.2", draft: true }]]),
      }).status,
      0,
    );
    const history = {
      FAKE_RELEASES: JSON.stringify([
        [{ tag_name: "android-v1.0.1", assets: [{ id: 1, name: "android-update.json" }] }],
      ]),
      FAKE_MANIFEST: '{"versionCode":1000003}',
    };
    assert.notEqual(run("validate", history).status, 0);
    assert.equal(run("validate", { ...history, VERSION_NAME: "1.0.4" }).status, 0);
  }));

test("manifest hashes actual APK bytes and preserves release notes literally", () =>
  fixture((run, root) => {
    const bytes = Buffer.from("fixture APK");
    writeFileSync(join(root, "release/MarkAI-1.0.2.apk"), bytes);
    const notes = "修复\n`literal` $(not-a-command)";
    assert.equal(run("manifest", { RELEASE_NOTES: notes }).status, 0);
    const manifest = JSON.parse(readFileSync(join(root, "release/android-update.json"), "utf8"));
    assert.equal(manifest.versionCode, 1000002);
    assert.equal(manifest.size, bytes.length);
    assert.equal(manifest.sha256, createHash("sha256").update(bytes).digest("hex"));
    const body = readFileSync(join(root, "release/notes.md"), "utf8");
    assert.ok(body.startsWith(notes));
    assert.deepEqual(
      JSON.parse(body.match(/<!-- markai-android-update\s*([\s\S]*?)\s*-->/)[1]),
      manifest,
    );
    assert.equal(
      manifest.downloads[0].url,
      "https://download.example.com/android/1.0.2/MarkAI-1.0.2.apk",
    );
  }));

test("Android release workflow has only a manual event", () => {
  const workflow = readFileSync(".github/workflows/android-release.yml", "utf8");
  const events = workflow.split("\non:\n")[1].split("\nconcurrency:")[0];
  assert.match(events, /(?:^|\n)  workflow_dispatch:/);
  assert.doesNotMatch(events, /\n  (push|pull_request|schedule|release|workflow_run):/);
  assert.doesNotMatch(events, /version_code:/);
});

test("version name alone determines increasing Android installation code", () => {
  assert.equal(versionCode("1.0.3"), 1000003);
  assert.ok(compareVersions("1.0.10", "1.0.9") > 0);
  assert.ok(compareVersions("1.1.0", "1.0.999") > 0);
  assert.throws(() => versionCode("1.0.1000"));
});
