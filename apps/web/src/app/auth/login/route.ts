import { NextResponse } from "next/server";
import { passwordMatches } from "@/lib/access.server";
import {
  ACCESS_COOKIE_NAME,
  getAccessToken,
  isAccessDisabled,
  isAccessGateEnabled,
  sanitizeNextPath,
} from "@/lib/access";

export async function POST(request: Request) {
  const formData = await request.formData();
  const nextPath = sanitizeNextPath(formData.get("next")?.toString());

  if (isAccessDisabled()) {
    return NextResponse.redirect(new URL("/login?disabled=1", request.url));
  }

  if (!isAccessGateEnabled()) {
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  const password = formData.get("password")?.toString() ?? "";
  const expectedPassword = process.env.CLIPZERO_APP_PASSWORD;

  if (!passwordMatches(password, expectedPassword)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    if (nextPath !== "/") {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  const token = getAccessToken();
  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
