import { NextRequest, NextResponse } from "next/server";

import { getRegistrationMode } from "@/lib/registration";

const REGISTRATION_BLOCKED_ERRORS = new Set([
  "REGISTRATION_NOT_ALLOWED",
  "当前未开放注册，请先申请加入等候名单",
]);

const LOGIN_ERROR_CODES = new Set([
  "access_denied",
  "email_not_found",
  "invalid_code",
  "oauth_provider_not_found",
]);

const getLocalCallbackUrl = (value: string | null) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/";

const getRedirectBaseUrl = (request: NextRequest) =>
  process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || request.url;

export function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error") || "oauth_failed";
  const provider = request.nextUrl.searchParams.get("provider");
  const callbackUrl = getLocalCallbackUrl(request.nextUrl.searchParams.get("callbackUrl"));
  const redirectBaseUrl = getRedirectBaseUrl(request);

  if (REGISTRATION_BLOCKED_ERRORS.has(error) && getRegistrationMode() === "waitlist") {
    const registerUrl = new URL("/register", redirectBaseUrl);
    registerUrl.searchParams.set("source", "oauth");
    if (provider === "github" || provider === "google") {
      registerUrl.searchParams.set("provider", provider);
    }
    return NextResponse.redirect(registerUrl);
  }

  const loginUrl = new URL("/login", redirectBaseUrl);
  if (callbackUrl !== "/") loginUrl.searchParams.set("callbackUrl", callbackUrl);
  loginUrl.searchParams.set(
    "oauthError",
    REGISTRATION_BLOCKED_ERRORS.has(error)
      ? "registration_closed"
      : LOGIN_ERROR_CODES.has(error)
        ? error
        : "oauth_failed",
  );
  return NextResponse.redirect(loginUrl);
}
