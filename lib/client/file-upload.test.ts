import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveFileContentType, uploadFile } from "./file-upload";

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

afterEach(() => vi.unstubAllGlobals());

describe("attachment upload lifecycle", () => {
  const file = new File(["hello"], "test.txt", { type: "text/plain" });
  const uploaded = {
    id: "file-1",
    name: "test.txt",
    contentType: "text/plain",
    size: 5,
    kind: "attachment",
  };
  it("reports real upload stages and completes the file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ file: uploaded, uploadUrl: "/upload" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ file: uploaded }));
    vi.stubGlobal("fetch", fetchMock);
    const onStage = vi.fn();
    expect(await uploadFile(file, { kind: "attachment", onStage })).toEqual(uploaded);
    expect(onStage.mock.calls.map((call) => call[0])).toEqual([
      "preparing",
      "uploading",
      "processing",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("cleans up a cancelled upload without completing it", async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ file: uploaded, uploadUrl: "/upload" }))
      .mockImplementationOnce((_url, options) => {
        expect(options.signal).toBe(controller.signal);
        controller.abort();
        return Promise.reject(new DOMException("Aborted", "AbortError"));
      })
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      uploadFile(file, { kind: "attachment", signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[2]).toEqual(["/api/files/file-1", { method: "DELETE" }]);
  });
  it("cleans up failed transfers and does not report processing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ file: uploaded, uploadUrl: "/upload" }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onStage = vi.fn();
    await expect(uploadFile(file, { kind: "attachment", onStage })).rejects.toThrow("文件上传失败");
    expect(onStage.mock.calls.map((call) => call[0])).toEqual(["preparing", "uploading"]);
    expect(fetchMock.mock.calls[2][1]).toEqual({ method: "DELETE" });
  });
});
