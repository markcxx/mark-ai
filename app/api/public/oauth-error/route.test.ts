import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const originalRegistrationMode = process.env.AUTH_REGISTRATION_MODE;
const originalAppUrl = process.env.APP_URL;
const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalRegistrationMode === undefined) {
    delete process.env.AUTH_REGISTRATION_MODE;
  } else {
    process.env.AUTH_REGISTRATION_MODE = originalRegistrationMode;
  }
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }
  if (originalNextPublicAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
  }
});

const requestOAuthError = (
  params: Record<string, string>,
  origin = "http://localhost:3000",
) => {
  const url = new URL("/api/public/oauth-error", origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return GET(new NextRequest(url));
};

describe("OAuth error redirect", () => {
  it("sends blocked social sign-ups to the waitlist application", () => {
    process.env.AUTH_REGISTRATION_MODE = "waitlist";

    const response = requestOAuthError({
      error: "当前未开放注册，请先申请加入等候名单",
      provider: "google",
    });
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/register");
    expect(location.searchParams.get("source")).toBe("oauth");
    expect(location.searchParams.get("provider")).toBe("google");
  });

  it("uses APP_URL instead of the internal request origin", () => {
    process.env.APP_URL = "https://ai.example.com";
    process.env.AUTH_REGISTRATION_MODE = "waitlist";

    const response = requestOAuthError(
      {
        error: "REGISTRATION_NOT_ALLOWED",
        provider: "google",
      },
      "https://0.0.0.0:3000",
    );
    const location = new URL(response.headers.get("location") || "");

    expect(location.origin).toBe("https://ai.example.com");
    expect(location.pathname).toBe("/register");
    expect(location.searchParams.get("source")).toBe("oauth");
    expect(location.searchParams.get("provider")).toBe("google");
  });

  it("returns blocked social sign-ups to login when registration is closed", () => {
    process.env.AUTH_REGISTRATION_MODE = "closed";

    const response = requestOAuthError({ error: "REGISTRATION_NOT_ALLOWED" });
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("oauthError")).toBe("registration_closed");
  });

  it("preserves safe callbacks for ordinary OAuth errors", () => {
    const response = requestOAuthError({
      callbackUrl: "/sessions/example",
      error: "invalid_code",
    });
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/sessions/example");
    expect(location.searchParams.get("oauthError")).toBe("invalid_code");
  });

  it("drops protocol-relative callback URLs", () => {
    const response = requestOAuthError({
      callbackUrl: "//example.com/path",
      error: "invalid_code",
    });
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.has("callbackUrl")).toBe(false);
  });
});
