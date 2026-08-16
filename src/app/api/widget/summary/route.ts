import { NextRequest, NextResponse } from "next/server";
import { verifyWidgetToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScoredDays, nutritionTotals } from "@/lib/scoring/engine";
import type { DailySummary, Meal } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Latest Recovery / Energy / Sleep / Strain / macros for a personal device (the
 * iOS widget).
 *
 * Auth: a widget bearer token (Authorization: Bearer <token>, or ?token=), NOT
 * a session cookie — so it works from a native extension. Read-only; returns
 * only headline numbers, nothing sensitive.
 *
 * The scores are produced by the SAME computeScoredDays the web app uses — we
 * just run it server-side over the account's stored snapshot, so there is no
 * duplicate health algorithm. Strain is 0–21 (matches the widget's strainMax).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const sub = verifyWidgetToken(bearer || url.searchParams.get("token") || undefined);
  if (!sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let snap: { data: string; updatedAt: number } | null = null;
  try {
    snap = await db().getSnapshot(sub);
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }
  if (!snap?.data) return NextResponse.json({ recovery: null, energy: null, sleep: null, sleepHours: null, strain: null, strainStatus: null, calories: null, protein: null, carbs: null, fat: null, updatedAt: 0 });

  let parsed: { wearableDays?: DailySummary[]; manualDays?: DailySummary[]; meals?: Meal[] };
  try {
    parsed = JSON.parse(snap.data) as typeof parsed;
  } catch {
    return NextResponse.json({ error: "bad_snapshot" }, { status: 500 });
  }

  // Reconstruct the merged day stream (manual + wearable, wearable wins per date)
  // exactly like the web app, then run the shared scoring engine.
  const byDate = new Map<string, DailySummary>();
  for (const d of parsed.manualDays ?? []) byDate.set(d.date, d);
  for (const d of parsed.wearableDays ?? []) byDate.set(d.date, d);
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const scored = computeScoredDays(days);
  const last = scored[scored.length - 1];

  if (!last) return NextResponse.json({ recovery: null, energy: null, sleep: null, sleepHours: null, strain: null, strainStatus: null, calories: null, protein: null, carbs: null, fat: null, updatedAt: snap.updatedAt });

  // Meals are a separate top-level list in the snapshot (not nested per day),
  // same as the web app's `todayTotals` — filter to the latest scored date.
  const todayMeals = (parsed.meals ?? []).filter((m) => m.date === last.day.date);
  const totals = nutritionTotals({ meals: todayMeals });

  const num = (r: { available?: boolean; score: number }) => (r.available === false ? null : Math.round(r.score));
  const res = NextResponse.json({
    date: last.day.date,
    recovery: num(last.recovery),
    recoveryStatus: last.recovery.available === false ? null : last.recovery.status,
    energy: num(last.energy),
    energyStatus: last.energy.available === false ? null : last.energy.status,
    sleep: num(last.sleep),
    sleepStatus: last.sleep.available === false ? null : last.sleep.status,
    sleepHours: last.day.sleep.asleepMin > 0 ? Math.round((last.day.sleep.asleepMin / 60) * 10) / 10 : null,
    strain: last.strain.available === false ? null : Math.round(last.strain.score * 10) / 10,
    strainStatus: last.strain.available === false ? null : last.strain.status,
    calories: totals.kcal,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    updatedAt: snap.updatedAt,
  });
  // Let the widget cache briefly; scores only change on sync.
  res.headers.set("Cache-Control", "private, max-age=300");
  return res;
}
