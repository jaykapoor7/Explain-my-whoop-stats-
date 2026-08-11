import { NextRequest, NextResponse } from "next/server";
import { clientId, COOKIES, decodeToken, encodeToken, refreshToken, syncFitbit } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let token = decodeToken(req.cookies.get(COOKIES.token)?.value);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let refreshed = false;
  if (token.expires_at < Date.now()) {
    const id = clientId(req);
    if (!id) return NextResponse.json({ error: "not_configured" }, { status: 401 });
    try {
      token = await refreshToken(id, token.refresh_token);
      refreshed = true;
    } catch {
      return NextResponse.json({ error: "refresh_failed" }, { status: 401 });
    }
  }

  try {
    const days = await syncFitbit(token.access_token, 30);
    const res = NextResponse.json({ days, count: days.length, syncedAt: new Date().toISOString() });
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
    return NextResponse.json({ error: "sync_failed", message: e instanceof Error ? e.message : "unknown" }, { status: 502 });
  }
}
