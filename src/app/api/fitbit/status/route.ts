import { NextRequest, NextResponse } from "next/server";
import { COOKIES, creds, decodeToken } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return NextResponse.json({
    configured: !!creds(req),
    connected: !!decodeToken(req.cookies.get(COOKIES.token)?.value),
    envConfigured: !!process.env.GOOGLE_CLIENT_ID,
  });
}
