import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ isCloudMode: () => true }));

import { middleware } from "../../middleware";

describe("cloud API authentication boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns JSON 401 for native clients instead of redirecting to HTML", async () => {
    const response = await middleware(new NextRequest("https://markai.test/api/sessions"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "请先登录" });
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps protected page redirects", async () => {
    const response = await middleware(new NextRequest("https://markai.test/session-id"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?callbackUrl=");
  });

  it("allows guest and mobile capability endpoints", async () => {
    for (const path of ["/", "/api/public/mobile-config", "/api/auth/get-session"]) {
      const response = await middleware(new NextRequest(`https://markai.test${path}`));
      expect(response.status).toBe(200);
    }
  });
});
