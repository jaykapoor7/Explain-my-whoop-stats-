import { NextRequest, NextResponse } from "next/server";
import { getSpec, resolvedConfig } from "@/lib/connections/server/config";
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
  const spec = getSpec(params.provider);
  if (!spec) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });

  const cookieName = tokenCookieName(params.provider);
  let token = parseToken(req.cookies.get(cookieName)?.value);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let refreshed = false;
  const config = resolvedConfig(params.provider, req);
  if (token.expires_at < Date.now() + 60_000 && token.refresh_token && config) {
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

  const res = NextResponse.json({ provider: params.provider, label: spec.label, days, count: days.length });
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
