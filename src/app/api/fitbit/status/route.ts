import { NextRequest, NextResponse } from "next/server";
import { clientId, COOKIES, decodeToken } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return NextResponse.json({
    configured: !!clientId(req),
    connected: !!decodeToken(req.cookies.get(COOKIES.token)?.value),
    envConfigured: !!process.env.FITBIT_CLIENT_ID,
  });
}
