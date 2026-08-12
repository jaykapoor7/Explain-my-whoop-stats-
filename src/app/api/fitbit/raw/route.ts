import { NextRequest, NextResponse } from "next/server";
import { COOKIES, creds, decodeToken, encodeToken, inspectHealth, refreshToken } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostic: returns the raw per-type HTTP status + field names from Google
 *  Health for this account, so a connection problem can be told apart from a
 *  field-mapping gap. Returns the user's own data only, behind their cookie. */
export async function GET(req: NextRequest) {
  let token = decodeToken(req.cookies.get(COOKIES.token)?.value);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let refreshed = false;
  if (token.expires_at < Date.now()) {
    const c = creds(req);
    if (!c) return NextResponse.json({ error: "not_configured" }, { status: 401 });
    try {
      token = await refreshToken(c, token.refresh_token);
      refreshed = true;
    } catch {
      return NextResponse.json({ error: "refresh_failed" }, { status: 401 });
    }
  }

  try {
    const probes = await inspectHealth(token.access_token);
    const res = NextResponse.json({ probes, checkedAt: new Date().toISOString() });
    if (refreshed) {
      res.cookies.set(COOKIES.token, encodeToken(token), {
        httpOnly: true,
        secure: new URL(req.url).protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (e) {
    return NextResponse.json({ error: "inspect_failed", message: e instanceof Error ? e.message : "unknown" }, { status: 502 });
  }
}
