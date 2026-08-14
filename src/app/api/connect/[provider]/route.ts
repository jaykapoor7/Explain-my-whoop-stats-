import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, getProvider, providerCreds } from "@/lib/providers";
import { pkcePair, randomToken } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a provider OAuth connect flow (Oura / Whoop / Fitbit / Polar). */
export function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const origin = new URL(req.url).origin;
  const p = getProvider(params.provider);
  if (!p) return NextResponse.redirect(new URL("/settings", origin));
  const { clientId } = providerCreds(p.id);
  if (!clientId) return NextResponse.redirect(new URL(`/settings?connect=${p.id}&reason=setup`, origin));

  const base = (process.env.APP_URL ?? origin).replace(/\/$/, "");
  const redirect = `${base}/api/connect/${p.id}/callback`;
  const state = randomToken();
  const opts = { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 600 };

  const pair = p.pkce ? pkcePair() : null;
  const res = NextResponse.redirect(authorizeUrl(p, clientId, redirect, state, pair?.challenge));
  res.cookies.set("hos_p_state", state, opts);
  if (pair) res.cookies.set("hos_p_verifier", pair.verifier, opts);
  return res;
}
