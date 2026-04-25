import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  getAccessToken,
  isAccessDisabled,
  isAccessGateEnabled,
} from "./src/lib/access";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  if (isAccessDisabled()) {
    if (pathname === "/login") {
      return NextResponse.next();
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("disabled", "1");
    return NextResponse.redirect(loginUrl);
  }

  if (!isAccessGateEnabled() || pathname === "/login") {
    return NextResponse.next();
  }

  const accessCookie = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (accessCookie && accessCookie === getAccessToken()) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
