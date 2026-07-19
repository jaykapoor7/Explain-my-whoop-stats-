import { NextRequest, NextResponse } from "next/server";
import { SPECS } from "@/lib/connections/server/config";
import { serializeToken, tokenCookieName } from "@/lib/connections/server/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Store a pasted long-lived access token (e.g. an Oura Personal Access Token)
 * as the provider's token cookie, so /api/sync works with zero OAuth setup.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { provider?: string; accessToken?: string };
  const spec = body.provider ? SPECS[body.provider] : undefined;
  if (!spec) return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
  const accessToken = body.accessToken?.trim();
  if (!accessToken) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    tokenCookieName(spec.id),
    serializeToken({ access_token: accessToken, expires_at: Date.now() + 10 * 365 * 864e5 }),
    {
      httpOnly: true,
      secure: new URL(req.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    }
  );
  return res;
}
