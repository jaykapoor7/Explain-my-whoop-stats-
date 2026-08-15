import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Returning, signed-in visitors skip the marketing landing at "/" and go
 * straight into the app. Everyone else (including a Google OAuth reviewer, who
 * isn't signed in) sees the public landing page that explains what CURA does.
 *
 * We only check for the presence of the session cookie here — the actual
 * signature is verified server-side by the API/pages; this is just routing.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/" && req.cookies.get("hos_session")) {
    return NextResponse.redirect(new URL("/today", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
