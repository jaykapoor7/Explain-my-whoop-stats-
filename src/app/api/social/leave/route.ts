import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leave a group (removes you; empties are cleaned up server-side). */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { groupId } = (await req.json().catch(() => ({}))) as { groupId?: string };
  if (!groupId) return NextResponse.json({ error: "group_required" }, { status: 400 });
  try {
    await db().removeMember(groupId, session.sub);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
