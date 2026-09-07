import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ share: vi.fn(), file: vi.fn(), bytes: vi.fn() }));
vi.mock("@/lib/chat/share-storage", () => ({ getConversationShare: mocks.share }));
vi.mock("@/lib/storage/file-storage", () => ({ getStoredFile: mocks.file, getStoredFileBytes: mocks.bytes }));
vi.mock("@/lib/storage/office-preview", () => ({ getOfficePreviewKind: () => undefined, createOfficePreviewResponse: vi.fn() }));
import { GET } from "./route";
const request = new Request("http://localhost/api/public/shares/t/files/f?action=preview");
const context = { params: Promise.resolve({ token: "t", fileId: "f" }) };
beforeEach(() => vi.resetAllMocks());
it("denies revoked or expired links and unrelated files before storage access", async () => {
  mocks.share.mockResolvedValue(undefined);
  expect((await GET(request, context)).status).toBe(404);
  mocks.share.mockResolvedValue({ userId: "owner", snapshot: { messages: [] } });
  expect((await GET(request, context)).status).toBe(404);
  expect(mocks.file).not.toHaveBeenCalled();
});
it("serves only referenced owner files without a signed URL or browser cache", async () => {
  mocks.share.mockResolvedValue({ userId: "owner", snapshot: { messages: [{ attachments: [{ id: "f" }] }] } });
  mocks.file.mockResolvedValue({ id: "f", kind: "attachment", contentType: "text/html", originalName: "test.html" });
  mocks.bytes.mockResolvedValue(new TextEncoder().encode("<script>alert(1)</script>"));
  const response = await GET(request, context);
  expect(mocks.file).toHaveBeenCalledWith("f", "owner", true);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  expect(response.headers.get("Location")).toBeNull();
});
