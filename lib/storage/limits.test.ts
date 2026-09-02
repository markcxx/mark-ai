import { describe, expect, it } from "vitest";

import { formatStorageLimitMb, resolveStorageLimits } from "./limits";

describe("storage limits", () => {
  it("uses readable MB defaults", () => {
    expect(resolveStorageLimits({})).toEqual({
      maxAvatarBytes: 5 * 1024 * 1024,
      maxFileBytes: 30 * 1024 * 1024,
      maxStorageBytes: 500 * 1024 * 1024,
    });
  });

  it("prefers MB variables while retaining byte-variable compatibility", () => {
    expect(
      resolveStorageLimits({
        MARKAI_MAX_FILE_BYTES: "1",
        MARKAI_MAX_FILE_MB: "30",
        R2_USER_MAX_AVATAR_MB: "5",
        R2_USER_MAX_STORAGE_BYTES: String(500 * 1024 * 1024),
      }),
    ).toEqual({
      maxAvatarBytes: 5 * 1024 * 1024,
      maxFileBytes: 30 * 1024 * 1024,
      maxStorageBytes: 500 * 1024 * 1024,
    });
  });

  it("rejects invalid configured limits", () => {
    expect(() => resolveStorageLimits({ MARKAI_MAX_FILE_MB: "0" })).toThrow(
      "MARKAI_MAX_FILE_MB 必须是大于 0 的数字",
    );
  });

  it("formats byte limits as readable MB values", () => {
    expect(formatStorageLimitMb(30 * 1024 * 1024)).toBe("30");
    expect(formatStorageLimitMb(2.5 * 1024 * 1024)).toBe("2.5");
  });
});
