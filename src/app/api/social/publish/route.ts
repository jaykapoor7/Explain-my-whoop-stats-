import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

/** Publish my latest recovery / sleep / strain to share with my groups. */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await db().publishScores(session.sub, {
      recovery: num(b.recovery),
      sleep: num(b.sleep),
      strain: num(b.strain),
      sleepHours: num(b.sleepHours),
      day: typeof b.day === "string" ? b.day : "",
      recovery7: num(b.recovery7),
      sleep7: num(b.sleep7),
      strain7: num(b.strain7),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
