import { NextRequest, NextResponse } from "next/server";
import { clientId, COOKIES, encodeToken, exchangeCode, redirectUri } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/settings?fitbit=error&reason=${reason}`, origin));

  const id = clientId(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verifier = req.cookies.get(COOKIES.verifier)?.value;
  if (url.searchParams.get("error")) return fail("denied");
  if (!id || !code || !state || !verifier) return fail("missing");
  if (state !== req.cookies.get(COOKIES.state)?.value) return fail("state");

  let token;
  try {
    token = await exchangeCode(id, code, redirectUri(origin), verifier);
  } catch {
    return fail("exchange");
  }

  const res = NextResponse.redirect(new URL("/settings?fitbit=connected", origin));
  res.cookies.set(COOKIES.token, encodeToken(token), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  res.cookies.set(COOKIES.state, "", { path: "/", maxAge: 0 });
  res.cookies.set(COOKIES.verifier, "", { path: "/", maxAge: 0 });
  return res;
}
