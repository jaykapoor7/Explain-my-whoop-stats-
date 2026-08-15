import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { db, isDurable } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // generous cap for a personal snapshot

/** Non-reversible, non-sensitive account tag for logs — never the raw Google
 * subject id, email, or any token. Just enough to correlate a device's GET/POST
 * to one account across the two-device sync test. */
const acct = (sub: string) => crypto.createHash("sha256").update(sub).digest("hex").slice(0, 8);

/** Count the entities inside a snapshot payload so logs can show whether the
 * journal / tasks / goals actually made it into the row — no personal content. */
function summarize(data: unknown): Record<string, number> {
  const d = (typeof data === "string" ? safeParse(data) : data) as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return {};
  const len = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v as object).length : 0);
  return {
    journal: len(d.journal), tasks: len(d.tasks), goalTargets: len(d.goalTargets),
    meals: len(d.meals), medications: len(d.medications), wearableDays: len(d.wearableDays),
  };
}
function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

/** Pull this account's cloud snapshot (authored data + wearable cache). */
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const durable = isDurable();
  const tag = acct(session.sub);
  try {
    const snap = await db().getSnapshot(session.sub);
    console.log("[sync] GET table=snapshots acct=%s durable=%s row=%s bytes=%d updatedAt=%d entities=%o",
      tag, durable, snap ? "found" : "none", snap?.data.length ?? 0, snap?.updatedAt ?? 0, summarize(snap?.data));
    return NextResponse.json({ ...(snap ?? { data: null, updatedAt: 0 }), durable });
  } catch (e) {
    console.error("[sync] GET failed acct=%s durable=%s err=%s", tag, durable, e instanceof Error ? e.message : e);
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
  const tag = acct(session.sub);
  try {
    await db().saveSnapshot(session.sub, serialized, updatedAt);
    console.log("[sync] POST table=snapshots acct=%s durable=%s bytes=%d updatedAt=%d entities=%o -> ok",
      tag, isDurable(), serialized.length, updatedAt, summarize(body.data));
    return NextResponse.json({ ok: true, updatedAt });
  } catch (e) {
    console.error("[sync] POST failed acct=%s err=%s", tag, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
