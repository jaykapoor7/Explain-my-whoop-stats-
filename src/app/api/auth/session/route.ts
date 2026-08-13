import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ signedIn: false });
  let user = null;
  try { user = await db().getUser(session.sub); } catch { /* storage hiccup */ }
  return NextResponse.json({
    signedIn: true,
    user: user ?? { sub: session.sub },
  });
}
