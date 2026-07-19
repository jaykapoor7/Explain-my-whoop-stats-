import "server-only";
import { DayRecord } from "../../types";
import { DayBuilder, isoHour, round1, ymd } from "./normalize";

const BASE = "https://api.ouraring.com/v2/usercollection";
const secToH = (s: number) => Math.round((s / 3600) * 10) / 10;

async function get<T>(path: string, token: string, start: string, end: string): Promise<T[]> {
  const qs = new URLSearchParams({ start_date: start, end_date: end });
  const res = await fetch(`${BASE}/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Oura ${path} ${res.status}`);
  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}

interface Readiness { day: string; score?: number; temperature_deviation?: number }
interface DailySleep { day: string; score?: number }
interface Sleep {
  day: string; type?: string; average_hrv?: number; lowest_heart_rate?: number;
  total_sleep_duration?: number; deep_sleep_duration?: number; rem_sleep_duration?: number;
  light_sleep_duration?: number; awake_time?: number; efficiency?: number;
  bedtime_start?: string; bedtime_end?: string; average_breath?: number;
}
interface Activity { day: string; steps?: number; active_calories?: number; total_calories?: number }
interface OuraWorkout { day: string; activity?: string; calories?: number; intensity?: string; start_datetime?: string; end_datetime?: string }

export async function syncOura(token: string): Promise<DayRecord[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 180 * 864e5);
  const s = ymd(start);
  const e = ymd(end);
  const b = new DayBuilder();

  for (const r of await get<Readiness>("daily_readiness", token, s, e).catch(() => [])) {
    const d = b.day(r.day);
    if (r.score != null) d.recovery = Math.round(r.score);
    if (r.temperature_deviation != null) d.skinTempC = round1(33.8 + r.temperature_deviation);
  }
  const dailySleep = await get<DailySleep>("daily_sleep", token, s, e).catch(() => []);
  for (const r of dailySleep) {
    // If readiness was unavailable, fall back to the sleep score as the recovery proxy.
    const d = b.day(r.day);
    if (d.recovery === undefined && r.score != null) d.recovery = Math.round(r.score);
  }
  for (const r of await get<Sleep>("sleep", token, s, e).catch(() => [])) {
    if (r.type && r.type !== "long_sleep") continue;
    const d = b.day(r.day);
    if (r.total_sleep_duration != null) d.sleepHours = secToH(r.total_sleep_duration);
    if (r.deep_sleep_duration != null) d.deepHours = secToH(r.deep_sleep_duration);
    if (r.rem_sleep_duration != null) d.remHours = secToH(r.rem_sleep_duration);
    if (r.light_sleep_duration != null) d.lightHours = secToH(r.light_sleep_duration);
    if (r.awake_time != null) d.awakeHours = secToH(r.awake_time);
    if (r.efficiency != null) d.sleepEfficiency = Math.round(r.efficiency);
    if (r.average_hrv != null) d.hrv = Math.round(r.average_hrv);
    if (r.lowest_heart_rate != null) d.rhr = Math.round(r.lowest_heart_rate);
    if (r.average_breath != null) d.respiratoryRate = round1(r.average_breath);
    if (r.bedtime_start) d.bedtimeHour = isoHour(r.bedtime_start, true);
    if (r.bedtime_end) d.wakeHour = isoHour(r.bedtime_end);
  }
  for (const r of await get<Activity>("daily_activity", token, s, e).catch(() => [])) {
    const d = b.day(r.day);
    if (r.steps != null) d.steps = r.steps;
    if (r.total_calories != null) d.calories = r.total_calories;
    if (r.active_calories != null) d.activeCalories = r.active_calories;
  }
  for (const w of await get<OuraWorkout>("workout", token, s, e).catch(() => [])) {
    const startHr = w.start_datetime ? isoHour(w.start_datetime) : undefined;
    const dur =
      w.start_datetime && w.end_datetime
        ? Math.round((Date.parse(w.end_datetime) - Date.parse(w.start_datetime)) / 60000)
        : 0;
    b.addWorkout(w.day, {
      date: w.day,
      sport: w.activity ? w.activity.replace(/\b\w/g, (c) => c.toUpperCase()) : "Workout",
      durationMin: dur,
      calories: w.calories,
      startHour: startHr,
      // Oura has no strain; approximate from intensity so activity charts populate.
      strain: w.intensity === "hard" ? 14 : w.intensity === "moderate" ? 10 : 6,
    });
  }
  return b.result();
}
