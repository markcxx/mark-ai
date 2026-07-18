import { NextRequest, NextResponse } from "next/server";

import { isCloudMode } from "@/lib/env";

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/public",
  "/api/waitlist",
  "/login",
  "/register",
  "/reset-password",
];

const isPublicPath = (pathname: string) => PUBLIC_PATHS.some((p) => pathname.startsWith(p));

export async function middleware(req: NextRequest) {
  if (!isCloudMode()) return NextResponse.next();

  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/images")) {
    return NextResponse.next();
  }

  const sessionCookie =
    req.cookies.get("better-auth.session_token") ||
    req.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
