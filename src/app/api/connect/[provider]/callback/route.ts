import { NextRequest, NextResponse } from "next/server";
import { encodeTokens, exchangeCode, getProvider, providerCookie, providerCreds } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const url = new URL(req.url);
  const origin = url.origin;
  const p = getProvider(params.provider);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/settings?connect=${params.provider}&reason=${reason}`, origin));
  if (!p) return NextResponse.redirect(new URL("/settings", origin));
  const { clientId, clientSecret } = providerCreds(p.id);
  if (!clientId || !clientSecret) return fail("setup");

  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verifier = req.cookies.get("hos_p_verifier")?.value;
  if (!code || !state || state !== req.cookies.get("hos_p_state")?.value) return fail("state");

  const base = (process.env.APP_URL ?? origin).replace(/\/$/, "");
  const redirect = `${base}/api/connect/${p.id}/callback`;
  let tokens;
  try {
    tokens = await exchangeCode(p, code, redirect, clientId, clientSecret, verifier);
  } catch {
    return fail("exchange");
  }

  const res = NextResponse.redirect(new URL(`/settings?connected=${p.id}`, origin));
  res.cookies.set(providerCookie(p.id), encodeTokens(tokens), {
    httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  res.cookies.set("hos_p_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("hos_p_verifier", "", { path: "/", maxAge: 0 });
  return res;
}
