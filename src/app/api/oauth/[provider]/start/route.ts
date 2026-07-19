import { NextRequest, NextResponse } from "next/server";
import { oauthReady, redirectUri, resolvedConfig } from "@/lib/connections/server/config";
import { buildAuthUrl, pkcePair, randomToken, STATE_COOKIE, VERIFIER_COOKIE } from "@/lib/connections/server/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const origin = new URL(req.url).origin;
  const config = resolvedConfig(params.provider, req);
  if (!config || !oauthReady(params.provider, req)) {
    // No credentials yet — bounce back so the in-app connect form opens.
    return NextResponse.redirect(new URL(`/connections?setup=${params.provider}`, origin));
  }

  const state = randomToken();
  const pkce = config.usePkce ? pkcePair() : undefined;
  const url = buildAuthUrl(config, redirectUri(origin, params.provider), state, pkce?.challenge);

  const res = NextResponse.redirect(url);
  const secure = new URL(req.url).protocol === "https:";
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set(STATE_COOKIE, `${params.provider}:${state}`, opts);
  if (pkce) res.cookies.set(VERIFIER_COOKIE, pkce.verifier, opts);
  return res;
}
