import { NextRequest, NextResponse } from "next/server";
import { OAUTH_CONFIG, isConfigured } from "@/lib/connections/server/config";
import { parseToken, tokenCookieName } from "@/lib/connections/server/oauth";
import { ConnectionStatus } from "@/lib/connections/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports, per OAuth provider, whether the server has credentials and
 *  whether this browser holds a valid token cookie. */
export function GET(req: NextRequest) {
  const statuses: ConnectionStatus[] = Object.keys(OAUTH_CONFIG).map((id) => ({
    id,
    configured: isConfigured(id),
    connected: !!parseToken(req.cookies.get(tokenCookieName(id))?.value),
  }));
  return NextResponse.json({ providers: statuses });
}
