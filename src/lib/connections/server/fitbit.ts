import "server-only";
import { DayRecord } from "../../types";
import { DayBuilder, isoHour, round1, ymd } from "./normalize";

const BASE = "https://api.fitbit.com";

async function fjson<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Iterate [start,end] windows of at most `maxDays` each, ending today. */
function windows(totalDays: number, maxDays: number): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  const today = new Date();
  let cursorEnd = today;
  let remaining = totalDays;
  while (remaining > 0) {
    const span = Math.min(maxDays, remaining);
    const start = new Date(cursorEnd.getTime() - (span - 1) * 864e5);
    out.push({ start: ymd(start), end: ymd(cursorEnd) });
    cursorEnd = new Date(start.getTime() - 864e5);
    remaining -= span;
  }
  return out;
}

const TOTAL = 180;

export async function syncFitbit(token: string): Promise<DayRecord[]> {
  const b = new DayBuilder();

  // Resting HR (range up to 1y)
  for (const w of windows(TOTAL, 365)) {
    const data = await fjson<{ "activities-heart"?: { dateTime: string; value?: { restingHeartRate?: number } }[] }>(
      `/1/user/-/activities/heart/date/${w.start}/${w.end}.json`,
      token
    );
    for (const r of data?.["activities-heart"] ?? []) {
      if (r.value?.restingHeartRate != null) b.day(r.dateTime).rhr = Math.round(r.value.restingHeartRate);
    }
  }

  // HRV (max 30-day windows)
  for (const w of windows(TOTAL, 30)) {
    const data = await fjson<{ hrv?: { dateTime: string; value?: { dailyRmssd?: number } }[] }>(
      `/1/user/-/hrv/date/${w.start}/${w.end}.json`,
      token
    );
    for (const r of data?.hrv ?? []) {
      if (r.value?.dailyRmssd != null) b.day(r.dateTime).hrv = Math.round(r.value.dailyRmssd);
    }
  }

  // Sleep (max 100-day windows)
  for (const w of windows(TOTAL, 100)) {
    const data = await fjson<{
      sleep?: {
        dateOfSleep: string; minutesAsleep?: number; efficiency?: number; isMainSleep?: boolean;
        startTime?: string; endTime?: string;
        levels?: { summary?: Record<string, { minutes?: number }> };
      }[];
    }>(`/1.2/user/-/sleep/date/${w.start}/${w.end}.json`, token);
    for (const s of data?.sleep ?? []) {
      if (s.isMainSleep === false) continue;
      const d = b.day(s.dateOfSleep);
      if (s.minutesAsleep != null) d.sleepHours = round1(s.minutesAsleep / 60);
      if (s.efficiency != null) d.sleepEfficiency = Math.round(s.efficiency);
      const sum = s.levels?.summary ?? {};
      if (sum.deep?.minutes != null) d.deepHours = round1(sum.deep.minutes / 60);
      if (sum.rem?.minutes != null) d.remHours = round1(sum.rem.minutes / 60);
      if (sum.light?.minutes != null) d.lightHours = round1(sum.light.minutes / 60);
      if (sum.wake?.minutes != null) d.awakeHours = round1(sum.wake.minutes / 60);
      if (s.startTime) d.bedtimeHour = isoHour(s.startTime, true);
      if (s.endTime) d.wakeHour = isoHour(s.endTime);
    }
  }

  // Steps & calories time series (range up to 1y)
  for (const w of windows(TOTAL, 365)) {
    const steps = await fjson<{ "activities-tracker-steps"?: { dateTime: string; value: string }[] }>(
      `/1/user/-/activities/tracker/steps/date/${w.start}/${w.end}.json`,
      token
    );
    for (const r of steps?.["activities-tracker-steps"] ?? []) {
      const v = parseInt(r.value, 10);
      if (isFinite(v) && v > 0) b.day(r.dateTime).steps = v;
    }
    const cals = await fjson<{ "activities-tracker-calories"?: { dateTime: string; value: string }[] }>(
      `/1/user/-/activities/tracker/calories/date/${w.start}/${w.end}.json`,
      token
    );
    for (const r of cals?.["activities-tracker-calories"] ?? []) {
      const v = parseInt(r.value, 10);
      if (isFinite(v) && v > 0) b.day(r.dateTime).calories = v;
    }
  }

  // Derive a rough day-strain proxy from steps so activity charts populate.
  for (const d of b.result()) {
    if (d.strain === undefined && d.steps !== undefined) {
      d.strain = round1(Math.min(21, 4 + (d.steps / 10000) * 8));
    }
  }
  return b.result();
}
