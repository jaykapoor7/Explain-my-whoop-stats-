import { NextRequest, NextResponse } from "next/server";
import { tokenCookieName } from "@/lib/connections/server/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(tokenCookieName(params.provider), "", { path: "/", maxAge: 0 });
  return res;
}
