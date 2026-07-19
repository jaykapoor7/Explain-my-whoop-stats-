import { NextRequest, NextResponse } from "next/server";
import { getOAuthConfig, isConfigured, redirectUri } from "@/lib/connections/server/config";
import { buildAuthUrl, pkcePair, randomToken, STATE_COOKIE, VERIFIER_COOKIE } from "@/lib/connections/server/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const config = getOAuthConfig(params.provider);
  const origin = new URL(req.url).origin;
  if (!config) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  if (!isConfigured(params.provider)) {
    // Not set up: bounce back with a flag the UI turns into setup instructions.
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
