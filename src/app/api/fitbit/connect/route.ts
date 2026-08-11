import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, COOKIES, creds, pkcePair, randomToken, redirectUri } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const c = creds(req);
  if (!c) return NextResponse.redirect(new URL("/settings?fitbit=setup", origin));

  const state = randomToken();
  const { verifier, challenge } = pkcePair();
  const res = NextResponse.redirect(authorizeUrl(c.id, redirectUri(origin), state, challenge));
  const opts = { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set(COOKIES.state, state, opts);
  res.cookies.set(COOKIES.verifier, verifier, opts);
  return res;
}
