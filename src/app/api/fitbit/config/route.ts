import { NextRequest, NextResponse } from "next/server";
import { COOKIES, encodeCreds } from "@/lib/fitbit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save the Google Cloud OAuth Web client credentials for the Google Health API. */
export async function POST(req: NextRequest) {
  const { clientId, clientSecret } = (await req.json().catch(() => ({}))) as {
    clientId?: string;
    clientSecret?: string;
  };
  const id = clientId?.trim();
  const secret = clientSecret?.trim();
  if (!id || !id.endsWith(".apps.googleusercontent.com"))
    return NextResponse.json(
      { error: "invalid_client_id", message: "Expected a Google OAuth Web Client ID ending in .apps.googleusercontent.com" },
      { status: 400 }
    );
  if (!secret)
    return NextResponse.json(
      { error: "missing_client_secret", message: "Google Web application clients require the client secret for the token exchange." },
      { status: 400 }
    );
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIES.client, encodeCreds({ id, secret }), {
    httpOnly: true,
    secure: new URL(req.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
