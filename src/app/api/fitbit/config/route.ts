import { NextRequest, NextResponse } from "next/server";
import { COOKIES } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save the user's Fitbit app Client ID (public PKCE client — no secret). */
export async function POST(req: NextRequest) {
  const { clientId } = (await req.json().catch(() => ({}))) as { clientId?: string };
  const id = clientId?.trim();
  if (!id || !/^[A-Z0-9]{4,12}$/i.test(id))
    return NextResponse.json({ error: "invalid_client_id" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIES.client, id, {
    httpOnly: true,
    secure: new URL(req.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
