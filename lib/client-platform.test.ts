import { describe, expect, it } from "vitest";
import { identifyClient } from "./client-platform";

describe("client platform identity", () => {
  it("separates Android apps from mobile browsers", () => {
    const headers = new Headers({
      "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Safari/537.36",
    });
    expect(identifyClient(headers)).toEqual({ platform: "web", appVersion: null });
    headers.set("x-markai-platform", "android");
    headers.set("x-markai-app-version", "1.0.8");
    expect(identifyClient(headers)).toEqual({ platform: "android", appVersion: "1.0.8" });
  });
  it.each(["", "Dart/3.13 (dart:io)", "curl/8.0"])(
    "keeps legacy/unidentifiable agent %s unknown",
    (agent) => {
      expect(identifyClient(new Headers({ "user-agent": agent })).platform).toBe("unknown");
    },
  );
  it("bounds untrusted metadata and ignores web app versions", () => {
    expect(identifyClient(new Headers({ "x-markai-platform": "ios" })).platform).toBe("unknown");
    expect(
      identifyClient(
        new Headers({ "x-markai-platform": "android", "x-markai-app-version": "x".repeat(500) }),
      ).appVersion,
    ).toBeNull();
    expect(
      identifyClient(new Headers({ "x-markai-platform": "web", "x-markai-app-version": "1.0.8" }))
        .appVersion,
    ).toBeNull();
  });
});
