import "server-only";
import type { Activity, DailySummary, SleepStageKind } from "../types";

/**
 * WHOOP API v1 → DailySummary. Docs: https://developer.whoop.com
 * Endpoints: /recovery (HRV/RHR/recovery), /activity/sleep (stages),
 * /cycle (day strain + avg HR + energy), /activity/workout (sessions).
 * Defensive parsing — field names from the public schema, to be validated
 * against a live account (same standard as the Oura + Google Health mappers).
 */

const BASE = "https://api.prod.whoop.com/developer/v1";
// eslint-disable-next-line
type J = Record<string, any>;

const numOf = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const dayOf = (iso: unknown): string => (typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : "");
const msToMin = (ms: unknown) => Math.round(numOf(ms) / 60000);
const kjToKcal = (kj: unknown) => Math.round(numOf(kj) / 4.184);

/** WHOOP paginates every collection with { records, next_token }. */
async function getAll(path: string, token: string, start: string, end: string): Promise<J[]> {
  const out: J[] = [];
  let nextToken: string | undefined;
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ start, end, limit: "25" });
    if (nextToken) q.set("nextToken", nextToken);
    const res = await fetch(`${BASE}${path}?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) break;
    const j = (await res.json()) as J;
    if (Array.isArray(j.records)) out.push(...j.records);
    nextToken = j.next_token || undefined;
    if (!nextToken) break;
  }
  return out;
}

export async function whoopFetchDays(token: string, days: number): Promise<DailySummary[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const startIso = start.toISOString();
  const endIso = new Date(end.getTime() + 86400000).toISOString();

  const [recovery, sleep, cycles, workouts] = await Promise.all([
    getAll("/recovery", token, startIso, endIso),
    getAll("/activity/sleep", token, startIso, endIso),
    getAll("/cycle", token, startIso, endIso),
    getAll("/activity/workout", token, startIso, endIso),
  ]);

  // Recovery is keyed by sleep_id; index it so we can attach it to the night.
  const recBySleep = new Map<string, J>();
  for (const r of recovery) if (r.sleep_id != null) recBySleep.set(String(r.sleep_id), r);

  // Main (non-nap) sleep per wake-day; keep the longest if several.
  const mainSleep = new Map<string, J>();
  for (const s of sleep) {
    if (s.nap === true) continue;
    const day = dayOf(s.end);
    if (!day) continue;
    const prev = mainSleep.get(day);
    const dur = (x: J) => numOf(x?.score?.stage_summary?.total_in_bed_time_milli);
    if (!prev || dur(s) > dur(prev)) mainSleep.set(day, s);
  }

  // Physiological cycle carries the day's strain + avg HR + energy burn.
  const cycleByDay = new Map<string, J>();
  for (const c of cycles) {
    const day = dayOf(c.start);
    if (day) cycleByDay.set(day, c);
  }

  const workoutsByDay = new Map<string, J[]>();
  for (const w of workouts) {
    const day = dayOf(w.start);
    if (!day) continue;
    (workoutsByDay.get(day) ?? workoutsByDay.set(day, []).get(day)!).push(w);
  }

  const out: DailySummary[] = [];
  const dates = new Set([...mainSleep.keys(), ...cycleByDay.keys()]);
  for (const date of dates) {
    if (!date) continue;
    const s = mainSleep.get(date);
    const rec = s?.id != null ? recBySleep.get(String(s.id)) : undefined;
    const c = cycleByDay.get(date);
    const st = s?.score?.stage_summary ?? {};

    const deep = msToMin(st.total_slow_wave_sleep_time_milli);
    const rem = msToMin(st.total_rem_sleep_time_milli);
    const light = msToMin(st.total_light_sleep_time_milli);
    const awake = msToMin(st.total_awake_time_milli);
    const inBedMin = msToMin(st.total_in_bed_time_milli);
    const asleepMin = Math.max(0, inBedMin - awake) || deep + rem + light;
    const hrv = Math.round(numOf(rec?.score?.hrv_rmssd_milli) * 1000) || Math.round(numOf(rec?.score?.hrv_rmssd_milli));
    const rhr = Math.round(numOf(rec?.score?.resting_heart_rate));

    const activities: Activity[] = (workoutsByDay.get(date) ?? []).map((w, i) => {
      const z = w?.score?.zone_duration ?? {};
      const zones = [z.zone_one_milli, z.zone_two_milli, z.zone_three_milli, z.zone_four_milli, z.zone_five_milli].map(msToMin);
      return {
        id: String(w.id ?? `whoop-${date}-${i}`),
        date,
        type: "Workout",
        start: String(w.start ?? `${date}T12:00:00`).slice(0, 19),
        durationMin: Math.max(0, msToMin(new Date(String(w.end)).getTime() - new Date(String(w.start)).getTime()) || 0),
        avgHr: Math.round(numOf(w?.score?.average_heart_rate)),
        maxHr: Math.round(numOf(w?.score?.max_heart_rate)),
        calories: kjToKcal(w?.score?.kilojoule),
        zones,
        load: Math.min(21, numOf(w?.score?.strain)),
        confidence: "high",
      };
    });

    out.push({
      date,
      hrv: { date, rmssdMs: hrv },
      rhr: { date, bpm: rhr },
      sleep: {
        date,
        bedtime: s?.start ? String(s.start).slice(0, 19) : `${date}T23:00:00`,
        wake: s?.end ? String(s.end).slice(0, 19) : `${date}T07:00:00`,
        inBedMin,
        asleepMin,
        efficiencyPct: Math.round(numOf(s?.score?.sleep_efficiency_percentage)),
        stages: { awake, light, deep, rem } as Record<SleepStageKind, number>,
        awakenings: Math.round(numOf(st.disturbance_count)),
        sleepHrBpm: Math.round(numOf(c?.score?.average_heart_rate)),
        overnightHrvMs: hrv,
        consistencyPct: Math.round(numOf(s?.score?.sleep_consistency_percentage)),
        debtMin: 0,
        needMin: msToMin(s?.score?.sleep_needed?.baseline_milli) || 480,
      },
      activities,
      steps: 0, // WHOOP does not expose step counts
      activeCalories: kjToKcal(c?.score?.kilojoule),
      restingCalories: 1500,
      meals: [],
      medicationEvents: [],
    });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
