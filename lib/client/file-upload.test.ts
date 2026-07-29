import { describe, expect, it } from "vitest";

import { resolveFileContentType } from "./file-upload";

describe("resolveFileContentType", () => {
  it("uses the known extension when the clipboard reports a generic MIME type", () => {
    expect(
      resolveFileContentType({ name: "legacy.doc", type: "application/octet-stream" } as File),
    ).toBe("application/msword");
    expect(
      resolveFileContentType({ name: "modern.docx", type: "application/octet-stream" } as File),
    ).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("keeps the browser MIME type for unknown extensions", () => {
    expect(resolveFileContentType({ name: "photo.custom", type: "image/png" } as File)).toBe(
      "image/png",
    );
  });
});
