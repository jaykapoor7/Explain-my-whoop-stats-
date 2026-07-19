import "server-only";
import { DayRecord } from "../../types";
import { DayBuilder, dateRange, isoDate, isoHour, kjToKcal, msToH, round1 } from "./normalize";

const BASE = "https://api.prod.whoop.com/developer/v1";

const SPORT: Record<number, string> = {
  0: "Running", 1: "Cycling", 16: "Weightlifting", 17: "Weightlifting", 18: "Rowing",
  22: "Tennis", 33: "Swimming", 43: "Yoga", 44: "Pilates", 45: "HIIT", 48: "Functional Fitness",
  52: "Hiking", 63: "Walking", 71: "Boxing", 96: "Meditation", 101: "Basketball",
};

/** Fetch a paginated WHOOP collection, following next_token (bounded). */
async function collect<T>(path: string, token: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < 12; page++) {
    const qs = new URLSearchParams({ ...params, limit: "25" });
    if (nextToken) qs.set("nextToken", nextToken);
    const res = await fetch(`${BASE}${path}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`WHOOP ${path} ${res.status}`);
    const json = (await res.json()) as { records?: T[]; next_token?: string };
    out.push(...(json.records ?? []));
    nextToken = json.next_token;
    if (!nextToken) break;
  }
  return out;
}

interface Rec { created_at: string; score?: { recovery_score?: number; resting_heart_rate?: number; hrv_rmssd_milli?: number; spo2_percentage?: number; skin_temp_celsius?: number } }
interface Slp { end: string; start: string; nap?: boolean; score?: { sleep_performance_percentage?: number; sleep_efficiency_percentage?: number; sleep_consistency_percentage?: number; respiratory_rate?: number; stage_summary?: Record<string, number>; sleep_needed?: Record<string, number> } }
interface Wk { start: string; sport_id?: number; score?: { strain?: number; average_heart_rate?: number; max_heart_rate?: number; kilojoule?: number; zone_duration?: Record<string, number> } }
interface Cyc { start: string; score?: { strain?: number; max_heart_rate?: number; kilojoule?: number } }

export async function syncWhoop(token: string): Promise<DayRecord[]> {
  const { start, end } = dateRange(180);
  const b = new DayBuilder();
  const params = { start, end };

  const recovery = await collect<Rec>("/recovery", token, params).catch(() => []);
  for (const r of recovery) {
    if (!r.score) continue;
    const d = b.day(isoDate(r.created_at));
    if (r.score.recovery_score != null) d.recovery = Math.round(r.score.recovery_score);
    if (r.score.hrv_rmssd_milli != null) d.hrv = Math.round(r.score.hrv_rmssd_milli * 1000);
    if (r.score.resting_heart_rate != null) d.rhr = Math.round(r.score.resting_heart_rate);
    if (r.score.spo2_percentage != null) d.spo2 = round1(r.score.spo2_percentage);
    if (r.score.skin_temp_celsius != null) d.skinTempC = round1(r.score.skin_temp_celsius);
  }

  const sleeps = await collect<Slp>("/activity/sleep", token, params).catch(() => []);
  for (const s of sleeps) {
    if (s.nap || !s.score?.stage_summary) continue;
    const st = s.score.stage_summary;
    const d = b.day(isoDate(s.end));
    const light = st.total_light_sleep_time_milli ?? 0;
    const deep = st.total_slow_wave_sleep_time_milli ?? 0;
    const rem = st.total_rem_sleep_time_milli ?? 0;
    const awake = st.total_awake_time_milli ?? 0;
    const asleep = light + deep + rem;
    if (asleep > 0) d.sleepHours = msToH(asleep);
    d.deepHours = msToH(deep);
    d.remHours = msToH(rem);
    d.lightHours = msToH(light);
    d.awakeHours = msToH(awake);
    if (s.score.sleep_efficiency_percentage != null) d.sleepEfficiency = Math.round(s.score.sleep_efficiency_percentage);
    if (s.score.sleep_consistency_percentage != null) d.sleepConsistency = Math.round(s.score.sleep_consistency_percentage);
    if (s.score.respiratory_rate != null) d.respiratoryRate = round1(s.score.respiratory_rate);
    const need = s.score.sleep_needed;
    if (need) {
      const total = Object.values(need).reduce((a, v) => a + (v ?? 0), 0);
      d.sleepNeedHours = msToH(total);
    }
    d.bedtimeHour = isoHour(s.start, true);
    d.wakeHour = isoHour(s.end);
  }

  const workouts = await collect<Wk>("/activity/workout", token, params).catch(() => []);
  for (const w of workouts) {
    if (!w.score) continue;
    const date = isoDate(w.start);
    const z = w.score.zone_duration ?? {};
    const zones = [
      z.zone_one_milli, z.zone_two_milli, z.zone_three_milli, z.zone_four_milli, z.zone_five_milli,
    ].map((v) => Math.round((v ?? 0) / 60000));
    b.addWorkout(date, {
      date,
      sport: SPORT[w.sport_id ?? -1] ?? "Workout",
      durationMin: 0,
      strain: w.score.strain != null ? round1(w.score.strain) : undefined,
      calories: w.score.kilojoule != null ? kjToKcal(w.score.kilojoule) : undefined,
      avgHr: w.score.average_heart_rate,
      maxHr: w.score.max_heart_rate,
      startHour: isoHour(w.start),
      zones: zones.some((v) => v > 0) ? zones : undefined,
    });
  }

  const cycles = await collect<Cyc>("/cycle", token, params).catch(() => []);
  for (const c of cycles) {
    if (!c.score) continue;
    const d = b.day(isoDate(c.start));
    if (c.score.strain != null) d.strain = round1(c.score.strain);
    if (c.score.kilojoule != null) d.calories = kjToKcal(c.score.kilojoule);
    if (c.score.max_heart_rate != null) d.maxHr = c.score.max_heart_rate;
  }

  // Fill workout durations from HR-zone totals where available.
  for (const d of b.result()) {
    for (const w of d.workouts ?? []) {
      if (!w.durationMin && w.zones) w.durationMin = w.zones.reduce((a, v) => a + v, 0);
    }
  }
  return b.result();
}
