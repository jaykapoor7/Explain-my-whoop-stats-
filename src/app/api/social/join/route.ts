import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Join a group by its invite code. */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const clean = (code ?? "").trim().toUpperCase();
  if (!clean) return NextResponse.json({ error: "code_required" }, { status: 400 });
  try {
    const group = await db().findGroupByCode(clean);
    if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await db().addMember(group.id, session.sub);
    return NextResponse.json({ group });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
