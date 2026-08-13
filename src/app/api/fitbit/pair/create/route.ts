import { NextRequest, NextResponse } from "next/server";
import { COOKIES, decodeToken } from "@/lib/fitbit/server";
import { createPairing } from "@/lib/fitbit/pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mint a one-time pairing code for the CURRENT device's connection, so another
 * device can pick it up without repeating the whole setup. Requires that this
 * device is actually connected.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIES.token)?.value;
  if (!token || !decodeToken(token)) {
    return NextResponse.json({ error: "not_connected", message: "Connect this device first, then pair another." }, { status: 400 });
  }
  const client = req.cookies.get(COOKIES.client)?.value;
  const { code, ttlMs } = createPairing({ token, client });
  const origin = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  return NextResponse.json({ code, url: `${origin}/pair?code=${encodeURIComponent(code)}`, ttlMs });
}
