import { NextRequest, NextResponse } from "next/server";
import { SPECS, oauthReady, resolveCreds } from "@/lib/connections/server/config";
import { parseToken, tokenCookieName } from "@/lib/connections/server/oauth";
import { ConnectionStatus } from "@/lib/connections/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per provider: whether OAuth is ready (creds present), whether a client-id is
 *  saved at all, and whether this browser holds a valid token/PAT. */
export function GET(req: NextRequest) {
  const providers: ConnectionStatus[] = Object.keys(SPECS).map((id) => ({
    id,
    configured: oauthReady(id, req),
    hasClientId: !!resolveCreds(id, req)?.clientId,
    connected: !!parseToken(req.cookies.get(tokenCookieName(id))?.value),
  }));
  return NextResponse.json({ providers });
}
