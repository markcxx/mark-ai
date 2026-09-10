export function versionCode(name) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(name || "")) {
    throw new Error("版本号必须是 X.Y.Z，例如 1.0.3");
  }
  const [major, minor, patch] = name.split(".").map(Number);
  const code = major * 1000000 + minor * 1000 + patch;
  if (minor > 999 || patch > 999 || code < 1 || code > 2100000000) {
    throw new Error("版本号超出 Android 支持范围：次版本号和修订号须在 0–999 内");
  }
  return code;
}

export function compareVersions(a, b) {
  return versionCode(a) - versionCode(b);
}
