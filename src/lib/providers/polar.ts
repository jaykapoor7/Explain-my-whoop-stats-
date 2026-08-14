import "server-only";
import type { DailySummary, SleepStageKind } from "../types";

/**
 * Polar AccessLink → DailySummary. Docs: https://www.polar.com/accesslink-api
 * Uses the non-transactional pull endpoints:
 *   /v3/users/sleep            — nights with stage durations (seconds)
 *   /v3/users/nightly-recharge — overnight HR + HRV (beat-to-beat / rMSSD)
 * Activity/steps ride Polar's transaction model and are left out for now.
 * Defensive parsing — to be validated against a live account.
 */

const BASE = "https://www.polaraccesslink.com/v3/users";
// eslint-disable-next-line
type J = Record<string, any>;

const numOf = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const secToMin = (s: unknown) => Math.round(numOf(s) / 60);

async function get(path: string, token: string, key: string): Promise<J[]> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return [];
  const j = (await res.json()) as J;
  return Array.isArray(j[key]) ? j[key] : [];
}

export async function polarFetchDays(token: string, days: number): Promise<DailySummary[]> {
  const [nights, recharges] = await Promise.all([
    get("/sleep", token, "nights"),
    get("/nightly-recharge", token, "recharges"),
  ]);

  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rechargeByDay = new Map<string, J>();
  for (const r of recharges) if (r?.date) rechargeByDay.set(String(r.date), r);

  const out: DailySummary[] = [];
  for (const n of nights) {
    const date = String(n?.date ?? "");
    if (!date || date < cutoff) continue;
    const rc = rechargeByDay.get(date);

    const deep = secToMin(n.deep_sleep);
    const rem = secToMin(n.rem_sleep);
    const light = secToMin(n.light_sleep);
    const awake = secToMin(n.total_interruption_duration);
    const asleepMin = deep + rem + light;
    const inBedMin = asleepMin + awake;
    const hrv = Math.round(numOf(rc?.heart_rate_variability_avg));
    const rhr = Math.round(numOf(rc?.heart_rate_avg));

    out.push({
      date,
      hrv: { date, rmssdMs: hrv },
      rhr: { date, bpm: rhr },
      sleep: {
        date,
        bedtime: n?.sleep_start_time ? String(n.sleep_start_time).slice(0, 19) : `${date}T23:00:00`,
        wake: n?.sleep_end_time ? String(n.sleep_end_time).slice(0, 19) : `${date}T07:00:00`,
        inBedMin,
        asleepMin,
        efficiencyPct: inBedMin ? Math.round((asleepMin / inBedMin) * 100) : 0,
        stages: { awake, light, deep, rem } as Record<SleepStageKind, number>,
        awakenings: 0,
        sleepHrBpm: rhr,
        overnightHrvMs: hrv,
        consistencyPct: 0,
        debtMin: 0,
        needMin: 480,
      },
      activities: [],
      steps: 0,
      activeCalories: 0,
      restingCalories: 1500,
      meals: [],
      medicationEvents: [],
    });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
