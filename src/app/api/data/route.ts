import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, isDurable } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // generous cap for a personal snapshot

/** Pull this account's cloud snapshot (authored data + wearable cache). */
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Durable = a real database is configured. Without it the file fallback is
  // read-only/ephemeral on serverless, so cross-device sync can't work — the
  // client uses this to tell the user the truth instead of a false "synced".
  const durable = isDurable();
  try {
    const snap = await db().getSnapshot(session.sub);
    return NextResponse.json({ ...(snap ?? { data: null, updatedAt: 0 }), durable });
  } catch {
    return NextResponse.json({ error: "storage", durable }, { status: 500 });
  }
}

/** Save this account's cloud snapshot. Last-write-wins by updatedAt. */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { data?: unknown; updatedAt?: number } | null;
  if (!body || typeof body.data === "undefined") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const serialized = typeof body.data === "string" ? body.data : JSON.stringify(body.data);
  if (serialized.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const updatedAt = typeof body.updatedAt === "number" ? body.updatedAt : Date.now();
  try {
    await db().saveSnapshot(session.sub, serialized, updatedAt);
    return NextResponse.json({ ok: true, updatedAt });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
