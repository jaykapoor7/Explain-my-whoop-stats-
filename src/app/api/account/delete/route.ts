import { NextRequest, NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth";
import { COOKIES } from "@/lib/fitbit/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Permanently delete the signed-in account: profile, stored Google token and
 * cloud snapshot are removed, and this device's cookies are cleared. */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await db().deleteUser(session.sub);
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  for (const name of [SESSION_COOKIE, COOKIES.token, COOKIES.client]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
