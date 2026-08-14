import { NextRequest, NextResponse } from "next/server";
import { getProvider, providerCookie } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const p = getProvider(params.provider);
  if (!p) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(providerCookie(p.id), "", { path: "/", maxAge: 0 });
  return res;
}
