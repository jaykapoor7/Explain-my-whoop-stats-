import { NextResponse } from "next/server";
import { COOKIES } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of [COOKIES.token, COOKIES.client, COOKIES.state, COOKIES.verifier]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
