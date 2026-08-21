import { NextRequest, NextResponse } from "next/server";
import { verifyWidgetToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScoredDays, nutritionTotals } from "@/lib/scoring/engine";
import { maxHrFromAge } from "@/lib/scoring/strain";
import { ageFromBirthYear } from "@/lib/scoring/health-age";
import { fmtTime, isoOf } from "@/lib/format";
import type { DailySummary, Meal, Medication, MedStatus, PlannerTask } from "@/lib/types";

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

  // Read the snapshot, retrying once on a transient storage error. Managed
  // Postgres poolers (Supabase/pgbouncer) occasionally drop a cold connection;
  // a bare 500 here makes the widget flip to "offline", so a quick retry keeps
  // it showing real data instead.
  let snap: { data: string; updatedAt: number } | null = null;
  let storageErr = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      snap = await db().getSnapshot(sub);
      storageErr = false;
      break;
    } catch {
      storageErr = true;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (storageErr) return NextResponse.json({ error: "storage" }, { status: 503 });
  if (!snap?.data) return NextResponse.json({ recovery: null, energy: null, sleep: null, sleepHours: null, strain: null, strainStatus: null, calories: null, caloriesBurnt: null, protein: null, carbs: null, fat: null, medications: [], updatedAt: 0 });

  let parsed: {
    wearableDays?: DailySummary[];
    manualDays?: DailySummary[];
    meals?: Meal[];
    activityResolutions?: Record<string, "confirmed" | "ignored" | "edited">;
    activityTypeEdits?: Record<string, string>;
    settings?: { birthYear?: number };
    tasks?: PlannerTask[];
    taskDone?: Record<string, boolean>;
    medications?: Medication[];
    medOverrides?: Record<string, { status: MedStatus; takenAt?: string }>;
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

  // Energy is a wake-period battery, NOT a calendar metric — it must not reset at
  // midnight. recovery/sleep are derived from last night's sleep, so they
  // correctly go null after midnight until a new sleep is logged; energy reflects
  // the user's current waking state and has to stay answerable until they sleep.
  // So we source energy from the most recent day that actually has an energy
  // value — the engine already carries the still-draining battery onto today when
  // no new sleep has happened — decoupled from `last`. When a new sleep completes,
  // a fresh energy score becomes the latest available one and energy resets then,
  // not at the clock rollover.
  let energyDay = last;
  for (let i = scored.length - 1; i >= 0; i--) {
    if (scored[i].energy.available !== false) { energyDay = scored[i]; break; }
  }

  if (!last) return NextResponse.json({ recovery: null, energy: null, sleep: null, sleepHours: null, strain: null, strainStatus: null, calories: null, caloriesBurnt: null, protein: null, carbs: null, fat: null, tasks: [], events: [], medications: [], updatedAt: snap.updatedAt });

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

  // --- Medication: today's scheduled doses ----------------------------------
  // Rebuild the same per-dose events the web app derives (deriveMedEvents), then
  // flag overdue server-side (past the scheduled time, on today, still untaken).
  // "now" in the user's local minutes-of-day, so overdue matches their clock.
  const localNow = new Date(Date.now() + (tzOffsetMin ?? 0) * 60_000);
  const nowMinutes = (tzOffsetMin != null ? localNow.getUTCHours() : localNow.getHours()) * 60 + (tzOffsetMin != null ? localNow.getUTCMinutes() : localNow.getMinutes());
  const toMinutes = (hhmm: string) => {
    const m = hhmm.match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
  };
  const medOverrides = parsed.medOverrides ?? {};
  const localDow = new Date(localToday + "T12:00:00Z").getUTCDay(); // 0=Sun … 6=Sat
  const meds = (parsed.medications ?? [])
    .filter((med) => med.startDate <= localToday && (!med.endDate || med.endDate >= localToday))
    .filter((med) => med.frequency !== "weekly" || (med.days ?? []).includes(localDow))
    .flatMap((med) => {
      const times = med.frequency === "as-needed" ? [] : med.times.length ? med.times : ["08:00"];
      return times.map((time) => {
        const id = `${localToday}-${med.id}-${time}`;
        const status = medOverrides[id]?.status ?? "pending";
        const taken = status === "taken";
        const overdue = !taken && status !== "skipped" && toMinutes(time) < nowMinutes;
        return {
          id,
          name: med.name,
          dose: med.dose && med.dose !== "—" ? med.dose : undefined,
          time: fmtTime(time),
          taken,
          overdue,
          _min: toMinutes(time),
        };
      });
    })
    // Order for the widget's 4-item cap: overdue first, then upcoming (both
    // untaken, by time), then taken doses last — so missed/pending stay visible.
    .sort((a, b) => Number(a.taken) - Number(b.taken) || Number(b.overdue) - Number(a.overdue) || a._min - b._min)
    .slice(0, 6)
    .map((m) => ({ id: m.id, name: m.name, dose: m.dose, time: m.time, taken: m.taken, overdue: m.overdue }));

  const num = (r: { available?: boolean; score: number }) => (r.available === false ? null : Math.round(r.score));

  const res = NextResponse.json({
    date: last.day.date,
    recovery: num(last.recovery),
    recoveryStatus: last.recovery.available === false ? null : last.recovery.status,
    // Energy from energyDay (carries across midnight), everything else from last.
    energy: num(energyDay.energy),
    energyStatus: energyDay.energy.available === false ? null : energyDay.energy.status,
    sleep: num(last.sleep),
    sleepStatus: last.sleep.available === false ? null : last.sleep.status,
    sleepHours: last.day.sleep.asleepMin > 0 ? Math.round((last.day.sleep.asleepMin / 60) * 10) / 10 : null,
    strain: last.strain.available === false ? null : Math.round(last.strain.score * 10) / 10,
    strainStatus: last.strain.available === false ? null : last.strain.status,
    calories: totals.kcal,
    caloriesBurnt: Math.round(last.day.activeCalories + last.day.restingCalories),
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    tasks,
    events,
    medications: meds,
    updatedAt: snap.updatedAt,
  });
  // Let the widget cache briefly; scores only change on sync.
  res.headers.set("Cache-Control", "private, max-age=300");
  return res;
}
