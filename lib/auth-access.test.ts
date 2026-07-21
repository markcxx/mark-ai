import { describe, expect, it } from "vitest";

import { isActiveBan } from "./auth-access";

const now = Date.parse("2026-07-21T08:00:00.000Z");

describe("isActiveBan", () => {
  it("allows users who are not banned", () => {
    expect(isActiveBan({ banned: false }, now)).toBe(false);
  });

  it("keeps permanent and unexpired bans active", () => {
    expect(isActiveBan({ banned: true }, now)).toBe(true);
    expect(isActiveBan({ banExpires: "2026-07-22T08:00:00.000Z", banned: true }, now)).toBe(true);
  });

  it("allows an expired temporary ban", () => {
    expect(isActiveBan({ banExpires: "2026-07-20T08:00:00.000Z", banned: true }, now)).toBe(false);
  });
});
