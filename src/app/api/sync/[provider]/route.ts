import { NextRequest, NextResponse } from "next/server";
import { getOAuthConfig } from "@/lib/connections/server/config";
import {
  parseToken,
  refreshToken,
  serializeToken,
  tokenCookieName,
} from "@/lib/connections/server/oauth";
import { syncProvider } from "@/lib/connections/server/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const config = getOAuthConfig(params.provider);
  if (!config) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });

  const cookieName = tokenCookieName(params.provider);
  let token = parseToken(req.cookies.get(cookieName)?.value);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let refreshed = false;
  if (token.expires_at < Date.now() + 60_000 && token.refresh_token) {
    try {
      token = await refreshToken(config, token.refresh_token);
      refreshed = true;
    } catch {
      return NextResponse.json({ error: "refresh_failed" }, { status: 401 });
    }
  }

  let days;
  try {
    days = await syncProvider(params.provider, token.access_token);
  } catch (e) {
    return NextResponse.json(
      { error: "sync_failed", message: e instanceof Error ? e.message : "unknown" },
      { status: 502 }
    );
  }

  const res = NextResponse.json({ provider: params.provider, label: config.label, days, count: days.length });
  if (refreshed) {
    const secure = new URL(req.url).protocol === "https:";
    res.cookies.set(cookieName, serializeToken(token), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });
  }
  return res;
}
