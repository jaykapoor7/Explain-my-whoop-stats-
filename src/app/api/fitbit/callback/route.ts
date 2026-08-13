import { NextRequest, NextResponse } from "next/server";
import { COOKIES, creds, encodeToken, exchangeCode, redirectUri } from "@/lib/fitbit/server";
import { db } from "@/lib/db";
import { decodeIdToken, encryptSecret, sessionCookieOptions, signSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/settings?fitbit=error&reason=${reason}`, origin));

  const c = creds(req);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verifier = req.cookies.get(COOKIES.verifier)?.value;
  if (url.searchParams.get("error")) return fail("denied");
  if (!c || !code || !state || !verifier) return fail("missing");
  if (state !== req.cookies.get(COOKIES.state)?.value) return fail("state");

  let token;
  try {
    token = await exchangeCode(c, code, redirectUri(origin), verifier);
  } catch {
    return fail("exchange");
  }

  const secure = url.protocol === "https:";
  const res = NextResponse.redirect(new URL("/today?fitbit=connected", origin));

  // Create / update the account from the Google identity, and persist the
  // refresh token (encrypted) so this account can sync from any device.
  const identity = decodeIdToken(token.id_token);
  if (identity) {
    try {
      await db().upsertUser({ sub: identity.sub, email: identity.email, name: identity.name, picture: identity.picture });
      if (token.refresh_token) await db().saveGoogleAuth(identity.sub, encryptSecret(token.refresh_token));
    } catch (e) {
      console.error("[auth] failed to persist account:", e);
    }
    res.cookies.set(COOKIES.session, signSession(identity.sub), sessionCookieOptions(secure));
  }

  // Keep this device's health token in an httpOnly cookie for on-demand sync
  // (identity token stripped — it's large and not needed after sign-in).
  res.cookies.set(
    COOKIES.token,
    encodeToken({ access_token: token.access_token, refresh_token: token.refresh_token, expires_at: token.expires_at }),
    { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 }
  );
  res.cookies.set(COOKIES.state, "", { path: "/", maxAge: 0 });
  res.cookies.set(COOKIES.verifier, "", { path: "/", maxAge: 0 });
  return res;
}
