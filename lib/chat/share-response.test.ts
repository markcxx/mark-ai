import { describe, expect, it } from "vitest";
import { readShareResponse } from "./share-response";

describe("share response handling", () => {
  it("handles empty and HTML server responses without exposing parser errors", async () => {
    for (const body of ["", "<html>Server error</html>", "null", "{}"])
      await expect(readShareResponse(new Response(body, { status: 500 }))).rejects.toThrow(
        "分享服务响应异常",
      );
  });
  it("preserves actionable Chinese errors and replaces raw English exceptions", async () => {
    await expect(
      readShareResponse(
        Response.json({ error: "分享服务尚未就绪，请联系管理员完成数据库更新" }, { status: 503 }),
      ),
    ).rejects.toThrow("数据库更新");
    await expect(
      readShareResponse(Response.json({ error: "relation does not exist" }, { status: 500 })),
    ).rejects.toThrow("分享服务响应异常");
    await expect(readShareResponse(new Response("", { status: 401 }))).rejects.toThrow("重新登录");
  });
  it("validates successful data instead of reporting malformed responses as success", async () => {
    for (const value of [null, {}, { share: {} }, { share: { path: "https://evil.example" } }])
      await expect(readShareResponse(Response.json(value))).rejects.toThrow("分享服务响应异常");
    const share = {
      path: `/share/${"a".repeat(43)}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
    expect(await readShareResponse(Response.json({ share }))).toEqual({ share });
    expect(await readShareResponse(Response.json({ share: null }))).toEqual({ share: null });
    expect(await readShareResponse(Response.json({ ok: true }))).toEqual({ ok: true });
  });
});
