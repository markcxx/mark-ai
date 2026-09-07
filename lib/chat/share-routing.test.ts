import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/env", () => ({ isCloudMode: () => true }));
import { middleware } from "@/middleware";

describe("anonymous share routing in cloud mode", () => {
  it("allows only the public viewer and public attachment routes without a cookie", async () => {
    for (const path of ["/share/example", "/api/public/shares/example/files/file"]) {
      const response = await middleware(new NextRequest(`https://markai.example${path}`));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });
  it("keeps management and other conversations protected", async () => {
    for (const path of ["/admin", "/private-session", "/api/sessions/private/share"]) {
      const response = await middleware(new NextRequest(`https://markai.example${path}`));
      expect(response.headers.get("location")).toContain("/login?");
    }
  });
});
