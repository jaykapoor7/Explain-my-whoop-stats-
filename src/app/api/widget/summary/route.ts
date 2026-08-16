import { NextRequest, NextResponse } from "next/server";
import { verifyWidgetToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScoredDays, nutritionTotals } from "@/lib/scoring/engine";
import { maxHrFromAge } from "@/lib/scoring/strain";
import { ageFromBirthYear } from "@/lib/scoring/health-age";
import { fmtTime, isoOf } from "@/lib/format";
import type { DailySummary, Meal, PlannerTask } from "@/lib/types";

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

  let parsed: {
    wearableDays?: DailySummary[];
    manualDays?: DailySummary[];
    meals?: Meal[];
    activityResolutions?: Record<string, "confirmed" | "ignored" | "edited">;
    activityTypeEdits?: Record<string, string>;
    settings?: { birthYear?: number };
    tasks?: PlannerTask[];
    taskDone?: Record<string, boolean>;
  };
  try {
    parsed = JSON.parse(snap.data) as typeof parsed;
  } catch {
    return NextResponse.json({ error: "bad_snapshot" }, { status: 500 });
  }

  // Reconstruct the merged day stream (manual + wearable, wearable wins per date)
  // EXACTLY like the web app (use-health.ts): merge by date, then apply the
  // user's activity resolutions and type edits, since those change the strain
  // load — and therefore the energy spend — the engine computes.
  const resolutions = parsed.activityResolutions ?? {};
  const typeEdits = parsed.activityTypeEdits ?? {};
  const byDate = new Map<string, DailySummary>();
  for (const d of parsed.manualDays ?? []) byDate.set(d.date, d);
  for (const d of parsed.wearableDays ?? []) byDate.set(d.date, d);
  const days = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      activities: d.activities.map((a) => {
        const res = resolutions[a.id];
        const type = typeEdits[a.id];
        return res || type ? { ...a, resolved: res, type: type ?? a.type } : a;
      }),
    }));

  // Match the web app number-for-number:
  //  · maxHr from the user's birth year (use-health.ts derives it the same way);
  //    without it the engine defaults to maxHr 185, shifting every activity load
  //    and the energy spent on it.
  //  · tz offset from the widget's ?tz= (minutes east of UTC) so "today" — and
  //    thus the live intraday energy decay — is picked in the user's local time,
  //    not the server's UTC. Falls back to UTC if the widget didn't send it.
  const maxHr = maxHrFromAge(ageFromBirthYear(parsed.settings?.birthYear));
  const tzRaw = url.searchParams.get("tz");
  const tzOffsetMin = tzRaw != null && Number.isFinite(Number(tzRaw)) ? Number(tzRaw) : undefined;
  const scored = computeScoredDays(days, { maxHr, now: Date.now(), tzOffsetMin });

  // The user's local calendar day (for meals eaten "today", and the planner).
  const localToday = tzOffsetMin != null ? isoOf(new Date(Date.now() + tzOffsetMin * 60_000), true) : isoOf(new Date());

  // IMPORTANT (midnight bug): don't blank the widget just because the clock
  // rolled past midnight and no data has synced for the new day yet. Show the
  // most recent day that actually has readings, so scores never fall to zero /
  // "offline" overnight. Only genuinely-empty accounts return nulls.
  const hasSignal = (d: (typeof scored)[number]) =>
    d.recovery.available !== false || d.sleep.available !== false || d.strain.available !== false || d.energy.available !== false;
  let last = scored[scored.length - 1];
  for (let i = scored.length - 1; i >= 0; i--) {
    if (hasSignal(scored[i])) { last = scored[i]; break; }
  }

  if (!last) return NextResponse.json({ recovery: null, energy: null, sleep: null, sleepHours: null, strain: null, strainStatus: null, calories: null, protein: null, carbs: null, fat: null, tasks: [], events: [], updatedAt: snap.updatedAt });

  // Macros = what's been eaten on the user's real local day (resets naturally at
  // midnight, unlike the scores above which carry the last real reading).
  const todayMeals = (parsed.meals ?? []).filter((m) => m.date === localToday);
  const totals = nutritionTotals({ meals: todayMeals });

  // --- Planner: to-do list (tasks) + today's timed schedule (events) ---------
  // Read the same snapshot the web app persists; done state can be overridden by
  // the per-device taskDone map. Pre-sort so the widget can just take the first
  // N in array order.
  const allTasks = parsed.tasks ?? [];
  const doneMap = parsed.taskDone ?? {};
  const isDone = (t: PlannerTask) => doneMap[t.id] ?? t.done;
  const prRank = (p: PlannerTask["priority"]) => (p === "high" ? 0 : p === "medium" ? 1 : 2);

  const tasks = allTasks
    .filter((t) => t.todo)
    .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || prRank(a.priority) - prRank(b.priority))
    .slice(0, 8)
    .map((t) => ({
      id: String(t.id),
      title: t.title,
      done: isDone(t),
      due: t.start ? fmtTime(t.start) : undefined,
      priority: t.priority,
    }));

  const events = allTasks
    .filter((t) => !t.todo && t.date === localToday)
    .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99"))
    .slice(0, 6)
    .map((t) => ({
      id: String(t.id),
      title: t.title,
      time: t.start ? fmtTime(t.start) : "",
    }));

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
    tasks,
    events,
    updatedAt: snap.updatedAt,
  });
  // Let the widget cache briefly; scores only change on sync.
  res.headers.set("Cache-Control", "private, max-age=300");
  return res;
}
