import { NextRequest, NextResponse } from "next/server";
import { getOAuthConfig, redirectUri } from "@/lib/connections/server/config";
import {
  exchangeCode,
  serializeToken,
  STATE_COOKIE,
  tokenCookieName,
  VERIFIER_COOKIE,
} from "@/lib/connections/server/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const url = new URL(req.url);
  const origin = url.origin;
  const config = getOAuthConfig(params.provider);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/connections?error=${params.provider}:${reason}`, origin));

  if (!config) return fail("unknown");
  if (url.searchParams.get("error")) return fail("denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;
  const verifier = req.cookies.get(VERIFIER_COOKIE)?.value;

  if (!code || !state) return fail("missing_code");
  if (stateCookie !== `${params.provider}:${state}`) return fail("bad_state");

  let token;
  try {
    token = await exchangeCode(config, code, redirectUri(origin, params.provider), verifier);
  } catch {
    return fail("exchange_failed");
  }

  const res = NextResponse.redirect(new URL(`/connections?connected=${params.provider}`, origin));
  const secure = url.protocol === "https:";
  res.cookies.set(tokenCookieName(params.provider), serializeToken(token), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  // Clear the transient PKCE/state cookies.
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(VERIFIER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
