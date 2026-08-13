import { NextRequest, NextResponse } from "next/server";
import { COOKIES } from "@/lib/fitbit/server";
import { redeemPairing } from "@/lib/fitbit/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redeem a pairing code on the NEW device: copy the connection's httpOnly
 * cookies onto this device, then let the client sync. Single-use.
 */
export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return NextResponse.json({ error: "missing_code" }, { status: 400 });

  const payload = redeemPairing(code);
  if (!payload) return NextResponse.json({ error: "invalid_or_expired" }, { status: 410 });

  const secure = new URL(req.url).protocol === "https:";
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIES.token, payload.token, opts);
  if (payload.client) res.cookies.set(COOKIES.client, payload.client, opts);
  return res;
}
