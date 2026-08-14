import { NextRequest, NextResponse } from "next/server";
import { decodeTokens, encodeTokens, getProvider, providerCookie, providerCreds, refreshTokens } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pull the last 30 days from a connected provider, mapped to DailySummary[]. */
export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const p = getProvider(params.provider);
  if (!p) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  let tokens = decodeTokens(req.cookies.get(providerCookie(p.id))?.value);
  if (!tokens) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let refreshed = false;
  if (tokens.expires_at < Date.now()) {
    const { clientId, clientSecret } = providerCreds(p.id);
    if (!clientId || !clientSecret) return NextResponse.json({ error: "not_configured" }, { status: 401 });
    try { tokens = await refreshTokens(p, tokens.refresh_token, clientId, clientSecret); refreshed = true; }
    catch { return NextResponse.json({ error: "refresh_failed" }, { status: 401 }); }
  }

  try {
    const days = await p.fetchDays(tokens.access_token, 30);
    const res = NextResponse.json({ days, count: days.length, syncedAt: new Date().toISOString() });
    if (refreshed) {
      res.cookies.set(providerCookie(p.id), encodeTokens(tokens), {
        httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (e) {
    return NextResponse.json({ error: "sync_failed", message: e instanceof Error ? e.message : "unknown" }, { status: 502 });
  }
}
