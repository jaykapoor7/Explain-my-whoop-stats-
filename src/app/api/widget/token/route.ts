import { NextRequest, NextResponse } from "next/server";
import { getSession, signWidgetToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issue a personal widget token for the signed-in account. The token is a
 * read-only bearer credential the iOS Lock Screen widget uses to fetch this
 * account's latest scores. Requires an authenticated session to mint.
 */
export function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = signWidgetToken(session.sub);
  const base = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  return NextResponse.json({ token, summaryUrl: `${base}/api/widget/summary`, appUrl: base });
}
