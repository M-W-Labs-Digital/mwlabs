import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { authCookiePrefix, safePostAuthPath } from "@/lib/auth-shared";
import { getAuthConfig } from "@/lib/auth-config";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/" &&
    request.headers.get("accept")?.includes("text/markdown")
  ) {
    return new NextResponse(
      [
        "# M&W Labs",
        "",
        "M&W Labs is an independent digital studio in Dhaka, Bangladesh, working with founders and teams worldwide.",
        "",
        "We build websites, software, brands, marketing campaigns, content, AI automation, and growth systems.",
        "",
        "## Contact",
        "- Email: hello@mwlabs.digital",
        "- Phone: +44 20 3769 7100",
        "- Location: Demra, Dhaka, Bangladesh",
        "",
        "## Key pages",
        "- [About](https://mwlabs.digital/#about)",
        "- [Services](https://mwlabs.digital/#services)",
        "- [Work](https://mwlabs.digital/work)",
        "- [Insights](https://mwlabs.digital/blog)",
        "- [Book a call](https://mwlabs.digital/book)",
        "- [Contact](https://mwlabs.digital/contact)",
        "- [Terms](https://mwlabs.digital/terms)",
      ].join("\n"),
      {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          Vary: "Accept",
        },
      },
    );
  }

  // The homepage also matches this proxy for Markdown content negotiation,
  // but remains public for normal browser requests.
  if (request.nextUrl.pathname === "/") return NextResponse.next();

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
  matcher: ["/", "/app/:path*", "/portal/:path*"],
};
