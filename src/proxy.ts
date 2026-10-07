import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { authCookiePrefix, safePostAuthPath } from "@/lib/auth-shared";
import { getAuthConfig } from "@/lib/auth-config";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: authCookiePrefix,
  });

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", process.env.NODE_ENV === "production" ? getAuthConfig().baseURL : request.url);
    signInUrl.searchParams.set("next", safePostAuthPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/portal/:path*"],
};
