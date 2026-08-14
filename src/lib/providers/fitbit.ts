import "server-only";
import type { DailySummary, SleepStageKind } from "../types";

/**
 * Fitbit Web API → DailySummary. Docs: https://dev.fitbit.com/build/reference/web-api
 * Uses date-range endpoints so a 30-day sync is a handful of calls, not 30×N:
 *   /1.2/sleep/date/{start}/{end}    — sessions with stage levels
 *   /1/activities/heart/date/{s}/{e} — resting HR per day
 *   /1/activities/steps|calories …   — daily time series
 *   /1/hrv/date/{start}/{end}        — nightly rMSSD
 * Defensive parsing — to be validated against a live account.
 */

// eslint-disable-next-line
type J = Record<string, any>;

const numOf = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function get(path: string, token: string): Promise<J | null> {
  const res = await fetch(`https://api.fitbit.com${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as J;
}

export async function fitbitFetchDays(token: string, days: number): Promise<DailySummary[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const s = isoDay(start);
  const e = isoDay(end);

  const [sleepR, heartR, stepsR, calR, hrvR] = await Promise.all([
    get(`/1.2/user/-/sleep/date/${s}/${e}.json`, token),
    get(`/1/user/-/activities/heart/date/${s}/${e}.json`, token),
    get(`/1/user/-/activities/steps/date/${s}/${e}.json`, token),
    get(`/1/user/-/activities/calories/date/${s}/${e}.json`, token),
    get(`/1/user/-/hrv/date/${s}/${e}.json`, token),
  ]);

  const rhrByDay = new Map<string, number>();
  for (const h of (heartR?.["activities-heart"] ?? []) as J[]) {
    const bpm = numOf(h?.value?.restingHeartRate);
    if (h?.dateTime && bpm) rhrByDay.set(String(h.dateTime), Math.round(bpm));
  }
  const stepsByDay = new Map<string, number>();
  for (const d of (stepsR?.["activities-steps"] ?? []) as J[]) if (d?.dateTime) stepsByDay.set(String(d.dateTime), Math.round(numOf(d.value)));
  const calByDay = new Map<string, number>();
  for (const d of (calR?.["activities-calories"] ?? []) as J[]) if (d?.dateTime) calByDay.set(String(d.dateTime), Math.round(numOf(d.value)));
  const hrvByDay = new Map<string, number>();
  for (const d of (hrvR?.hrv ?? []) as J[]) {
    const rmssd = numOf(d?.value?.dailyRmssd);
    if (d?.dateTime && rmssd) hrvByDay.set(String(d.dateTime), Math.round(rmssd));
  }

  // Main sleep per day (Fitbit flags isMainSleep; keyed by the wake date).
  const mainSleep = new Map<string, J>();
  for (const sl of (sleepR?.sleep ?? []) as J[]) {
    const day = String(sl.dateOfSleep ?? "");
    if (!day) continue;
    if (sl.isMainSleep || !mainSleep.has(day)) mainSleep.set(day, sl);
  }

  const out: DailySummary[] = [];
  const dates = new Set([...mainSleep.keys(), ...stepsByDay.keys()]);
  for (const date of dates) {
    if (!date) continue;
    const sl = mainSleep.get(date);
    const lv = sl?.levels?.summary ?? {};
    // Modern "stages" sleep vs older "classic" (asleep/restless/awake).
    const deep = Math.round(numOf(lv.deep?.minutes));
    const rem = Math.round(numOf(lv.rem?.minutes));
    const light = Math.round(numOf(lv.light?.minutes));
    const awake = Math.round(numOf(lv.wake?.minutes) || numOf(lv.awake?.minutes));
    const asleepMin = Math.round(numOf(sl?.minutesAsleep)) || deep + rem + light;
    const inBedMin = Math.round(numOf(sl?.timeInBed)) || asleepMin + awake;

    out.push({
      date,
      hrv: { date, rmssdMs: hrvByDay.get(date) ?? 0 },
      rhr: { date, bpm: rhrByDay.get(date) ?? 0 },
      sleep: {
        date,
        bedtime: sl?.startTime ? String(sl.startTime).slice(0, 19) : `${date}T23:00:00`,
        wake: sl?.endTime ? String(sl.endTime).slice(0, 19) : `${date}T07:00:00`,
        inBedMin,
        asleepMin,
        efficiencyPct: Math.round(numOf(sl?.efficiency)),
        stages: { awake, light, deep, rem } as Record<SleepStageKind, number>,
        awakenings: 0,
        sleepHrBpm: 0,
        overnightHrvMs: hrvByDay.get(date) ?? 0,
        consistencyPct: 0,
        debtMin: 0,
        needMin: 480,
      },
      activities: [],
      steps: stepsByDay.get(date) ?? 0,
      activeCalories: calByDay.get(date) ?? 0,
      restingCalories: 1500,
      meals: [],
      medicationEvents: [],
    });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
