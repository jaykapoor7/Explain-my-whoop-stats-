import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS, decodeTokens, providerCookie, providerCreds } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** For each connector: is it configured on this deployment, and connected here? */
export function GET(req: NextRequest) {
  const providers = Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    tagline: p.tagline,
    configured: !!providerCreds(p.id).clientId,
    connected: !!decodeTokens(req.cookies.get(providerCookie(p.id))?.value),
    mapped: true, // all four connectors have a finished data mapping
  }));
  return NextResponse.json({ providers });
}
