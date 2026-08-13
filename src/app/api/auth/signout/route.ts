import { NextRequest, NextResponse } from "next/server";
import { COOKIES } from "@/lib/fitbit/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign out of this device: clear the session + this device's health token.
 * (The account and its cloud data remain; signing in again restores them.) */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  for (const name of [SESSION_COOKIE, COOKIES.token, COOKIES.client]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
