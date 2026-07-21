import { describe, expect, it } from "vitest";

import { hasInvalidExpectedRevision, isMessage, parseExpectedRevision } from "./message-validation";

describe("message validation", () => {
  it("accepts valid messages and rejects malformed attachments", () => {
    expect(isMessage({ content: "你好", id: "m1", role: "user" })).toBe(true);
    expect(
      isMessage({
        attachments: [{ contentType: "text/plain", id: "f1", name: "a.txt" }],
        content: "你好",
        id: "m1",
        role: "user",
      }),
    ).toBe(false);
  });

  it("parses numeric and ETag-style revisions", () => {
    expect(parseExpectedRevision(3)).toBe(3);
    expect(parseExpectedRevision('W/"12"')).toBe(12);
    expect(hasInvalidExpectedRevision("-1")).toBe(true);
    expect(hasInvalidExpectedRevision(undefined)).toBe(false);
  });
});
