import "server-only";
import type { Activity, DailySummary } from "../types";

/**
 * Oura API v2 → DailySummary. Docs: https://cloud.ouraring.com/v2/docs
 * Endpoints used: /sleep (detailed sessions), /daily_activity, /daily_readiness.
 * Defensive parsing — field names verified against the public schema but not
 * yet against a live account.
 */

const BASE = "https://api.ouraring.com/v2/usercollection";
// eslint-disable-next-line
type J = Record<string, any>;

const numOf = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function get(path: string, token: string): Promise<J[]> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as J;
  return Array.isArray(j.data) ? j.data : [];
}

export async function ouraFetchDays(token: string, days: number): Promise<DailySummary[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const range = `?start_date=${isoDay(start)}&end_date=${isoDay(new Date(end.getTime() + 86400000))}`;

  const [sleep, activity, readiness] = await Promise.all([
    get(`/sleep${range}`, token),
    get(`/daily_activity${range}`, token),
    get(`/daily_readiness${range}`, token),
  ]);

  // Keep the longest sleep session per day (the main sleep).
  const mainSleep = new Map<string, J>();
  for (const s of sleep) {
    const day = String(s.day ?? "");
    if (!day) continue;
    const prev = mainSleep.get(day);
    if (!prev || numOf(s.total_sleep_duration) > numOf(prev.total_sleep_duration)) mainSleep.set(day, s);
  }
  const actByDay = new Map(activity.map((a) => [String(a.day ?? ""), a]));
  const readyByDay = new Map(readiness.map((r) => [String(r.day ?? ""), r]));

  const out: DailySummary[] = [];
  const dates = new Set([...mainSleep.keys(), ...actByDay.keys()]);
  for (const date of dates) {
    if (!date) continue;
    const s = mainSleep.get(date);
    const a = actByDay.get(date);
    const rd = readyByDay.get(date);

    const asleepMin = s ? Math.round(numOf(s.total_sleep_duration) / 60) : 0;
    const deep = s ? Math.round(numOf(s.deep_sleep_duration) / 60) : 0;
    const rem = s ? Math.round(numOf(s.rem_sleep_duration) / 60) : 0;
    const light = s ? Math.round(numOf(s.light_sleep_duration) / 60) : 0;
    const awake = s ? Math.round(numOf(s.awake_time) / 60) : 0;
    const inBedMin = asleepMin + awake || (s ? Math.round(numOf(s.time_in_bed) / 60) : 0);
    const hrv = s ? Math.round(numOf(s.average_hrv)) : 0;
    // Oura resting HR ≈ lowest overnight HR; fall back to readiness contributor.
    const rhr = Math.round(numOf(s?.lowest_heart_rate) || numOf(rd?.contributors?.resting_heart_rate));

    out.push({
      date,
      hrv: { date, rmssdMs: hrv },
      rhr: { date, bpm: rhr },
      sleep: {
        date,
        bedtime: s?.bedtime_start ? String(s.bedtime_start).slice(0, 19) : `${date}T23:00:00`,
        wake: s?.bedtime_end ? String(s.bedtime_end).slice(0, 19) : `${date}T07:00:00`,
        inBedMin,
        asleepMin,
        efficiencyPct: s ? Math.round(numOf(s.efficiency)) : 0,
        stages: { awake, light, deep, rem },
        awakenings: 0,
        sleepHrBpm: Math.round(numOf(s?.average_heart_rate)),
        overnightHrvMs: hrv,
        consistencyPct: 0,
        debtMin: 0,
        needMin: 480,
      },
      activities: [] as Activity[],
      steps: Math.round(numOf(a?.steps)),
      activeCalories: Math.round(numOf(a?.active_calories)),
      restingCalories: Math.max(0, Math.round(numOf(a?.total_calories) - numOf(a?.active_calories))) || 1500,
      meals: [],
      medicationEvents: [],
    });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
