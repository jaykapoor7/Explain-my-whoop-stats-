import { NextRequest, NextResponse } from "next/server";
import { SPECS, credCookieName, serializeCreds } from "@/lib/connections/server/config";
import { tokenCookieName } from "@/lib/connections/server/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save a provider's OAuth client credentials in a secure cookie (no env vars). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    provider?: string;
    clientId?: string;
    clientSecret?: string;
  };
  const spec = body.provider ? SPECS[body.provider] : undefined;
  if (!spec) return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
  const clientId = body.clientId?.trim();
  if (!clientId) return NextResponse.json({ error: "missing_client_id" }, { status: 400 });
  if (spec.secretRequired && !body.clientSecret?.trim())
    return NextResponse.json({ error: "missing_client_secret" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    credCookieName(spec.id),
    serializeCreds({ clientId, clientSecret: body.clientSecret?.trim() || undefined }),
    {
      httpOnly: true,
      secure: new URL(req.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    }
  );
  return res;
}

/** Forget a provider's credentials and any token. */
export async function DELETE(req: NextRequest) {
  const provider = new URL(req.url).searchParams.get("provider");
  if (!provider || !SPECS[provider])
    return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(credCookieName(provider), "", { path: "/", maxAge: 0 });
  res.cookies.set(tokenCookieName(provider), "", { path: "/", maxAge: 0 });
  return res;
}
