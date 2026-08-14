import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List the groups I'm in, each with its members' latest shared scores. */
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const groups = await db().listGroups(session.sub);
    const withMembers = await Promise.all(
      groups.map(async (g) => ({ ...g, isOwner: g.ownerSub === session.sub, members: await db().memberScores(g.id) }))
    );
    return NextResponse.json({ groups: withMembers });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}

/** Create a new group; the creator becomes its first member. */
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const clean = (name ?? "").trim();
  if (!clean) return NextResponse.json({ error: "name_required" }, { status: 400 });
  try {
    const group = await db().createGroup(session.sub, clean);
    return NextResponse.json({ group });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
}
