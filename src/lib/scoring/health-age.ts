import { ScoredDay } from "./engine";
import { clamp } from "../format";

/**
 * Health Age — a "your body vs the calendar" estimate, in the spirit of
 * WHOOP Age. It reads the metrics that track physiological aging (resting
 * heart rate, HRV, sleep, daily activity) against rough age-expected norms
 * and returns an estimated physiological age plus the factors moving it.
 *
 * NOTE: a deliberate, deterministic placeholder — NOT a validated clinical
 * model. It never claims medical meaning; it explains its own factors.
 */

export interface AgeFactor {
  label: string;
  years: number; // negative = makes you younger, positive = older
  detail: string;
}

export interface HealthAgeResult {
  available: boolean;
  reason?: string; // why unavailable (no age set / not enough data)
  actualAge: number;
  physioAge: number;
  deltaYears: number; // physioAge - actualAge (negative = younger than your age)
  status: string;
  headline: string;
  factors: AgeFactor[];
  sampleDays: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const std = (xs: number[]) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

// Adult age-expected references — population medians for a healthy adult, so
// a typical person sits near zero (not athlete targets that penalise everyone).
const expectedHrv = (age: number) => clamp(52 - (age - 25) * 0.5, 24, 58); // ms rMSSD, declines with age
const expectedRhr = (age: number) => clamp(62 + Math.max(0, age - 35) * 0.05, 60, 68); // bpm

export function ageFromBirthYear(birthYear: number | undefined, today = new Date()): number | undefined {
  if (!birthYear) return undefined;
  const age = today.getFullYear() - birthYear;
  return age >= 13 && age <= 100 ? age : undefined;
}

/** ISO date of the most recent Sunday on or before `today`. */
export function mostRecentSunday(today = new Date()): string {
  const x = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  x.setDate(x.getDate() - x.getDay()); // getDay(): 0 = Sunday
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

/** Health Age that only refreshes weekly (anchored to the last Sunday), like
 * WHOOP Age — so the number is stable through the week instead of drifting
 * every day. Falls back to all data for brand-new users. */
export function calcHealthAgeWeekly(days: ScoredDay[], actualAge: number | undefined): HealthAgeResult {
  const sunday = mostRecentSunday();
  const upTo = days.filter((s) => s.day.date <= sunday);
  const r = calcHealthAge(upTo.length ? upTo : days, actualAge);
  return r.available ? r : calcHealthAge(days, actualAge);
}

/** Health Age computed as of each day (rolling window), for a trend line. */
export function healthAgeTrend(days: ScoredDay[], actualAge: number | undefined): { date: string; value: number }[] {
  if (!actualAge) return [];
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < days.length; i++) {
    const r = calcHealthAge(days.slice(0, i + 1), actualAge);
    if (r.available) out.push({ date: days[i].day.date, value: r.physioAge });
  }
  return out;
}

export function calcHealthAge(days: ScoredDay[], actualAge: number | undefined): HealthAgeResult {
  const base: HealthAgeResult = {
    available: false, actualAge: actualAge ?? 0, physioAge: 0, deltaYears: 0,
    status: "No data", headline: "", factors: [], sampleDays: 0,
  };
  if (!actualAge) return { ...base, reason: "set-age" };

  const recentDays = days.slice(-28);
  const recent = recentDays.map((s) => s.day);
  const hrvSeries = recent.filter((d) => d.hrv.rmssdMs > 0).map((d) => d.hrv.rmssdMs);
  const hrv = mean(hrvSeries);
  const hrvCv = isFinite(std(hrvSeries)) && hrv > 0 ? std(hrvSeries) / hrv : NaN; // coefficient of variation
  const rhr = mean(recent.filter((d) => d.rhr.bpm > 0).map((d) => d.rhr.bpm));
  const sleepMin = mean(recent.filter((d) => d.sleep.asleepMin > 0).map((d) => d.sleep.asleepMin));
  const sleepEff = mean(recent.filter((d) => d.sleep.efficiencyPct > 0).map((d) => d.sleep.efficiencyPct));
  const consistency = mean(recent.filter((d) => d.sleep.consistencyPct > 0).map((d) => d.sleep.consistencyPct));
  const steps = mean(recent.filter((d) => d.steps > 0).map((d) => d.steps));
  const recoveryAvg = mean(recentDays.filter((s) => s.recovery.available !== false).map((s) => s.recovery.score));
  // Structured training: share of days with a real counted workout.
  const trainingDays = recent.filter((d) => d.activities.some((a) => a.confidence !== "low" && a.durationMin >= 15)).length;
  const trainingRate = recent.length ? trainingDays / recent.length : NaN; // 0..1
  const nCore = recent.filter((d) => d.hrv.rmssdMs > 0 || d.rhr.bpm > 0).length;
  if (nCore < 5) return { ...base, actualAge, reason: "need-data" };

  const factors: AgeFactor[] = [];
  const push = (label: string, years: number, detail: string) => {
    const y = clamp(years, -5, 5);
    if (Math.abs(y) >= 0.3) factors.push({ label, years: y, detail });
    return y;
  };

  let adj = 0;
  // --- Cardiovascular / autonomic ---
  if (isFinite(hrv)) adj += push("HRV", -(hrv - expectedHrv(actualAge)) * 0.07, `${Math.round(hrv)} ms vs ~${Math.round(expectedHrv(actualAge))} typical for your age`);
  if (isFinite(hrvCv)) adj += push("HRV stability", (hrvCv - 0.16) * 14, `${Math.round(hrvCv * 100)}% night-to-night variation`);
  if (isFinite(rhr)) adj += push("Resting heart rate", (rhr - expectedRhr(actualAge)) * 0.22, `${Math.round(rhr)} bpm vs ~${Math.round(expectedRhr(actualAge))} typical`);
  // --- Sleep ---
  if (isFinite(sleepMin)) {
    const h = sleepMin / 60;
    adj += push("Sleep duration", (Math.abs(h - 7.5) * 0.9 - 0.4), `${h.toFixed(1)}h average per night`);
  }
  if (isFinite(sleepEff)) adj += push("Sleep efficiency", -(sleepEff - 85) * 0.07, `${Math.round(sleepEff)}% asleep in bed`);
  if (isFinite(consistency)) adj += push("Sleep consistency", -(consistency - 78) * 0.04, `${Math.round(consistency)}% regular timing`);
  // --- Activity / fitness ---
  if (isFinite(steps)) adj += push("Daily activity", -((steps - 6500) / 4000) * 1.0, `${Math.round(steps).toLocaleString()} steps/day`);
  if (isFinite(trainingRate)) adj += push("Structured training", -(trainingRate - 0.22) * 3.2, `${trainingDays} workout day${trainingDays === 1 ? "" : "s"} in ${recent.length}`);
  // --- Recovery capacity ---
  if (isFinite(recoveryAvg)) adj += push("Recovery capacity", -(recoveryAvg - 58) * 0.045, `${Math.round(recoveryAvg)}% average recovery`);

  // Keep the overall swing sane even if several factors line up the same way.
  const physioAge = Math.round(clamp(actualAge + clamp(adj, -12, 12), 13, 100));
  const delta = physioAge - actualAge;
  factors.sort((a, b) => Math.abs(b.years) - Math.abs(a.years));

  const status = delta <= -3 ? "Ahead of the curve" : delta <= -1 ? "Younger than your age" : delta < 1 ? "Right on pace" : delta < 3 ? "Slightly ahead of your age" : "Room to turn back the clock";
  const younger = delta < 0;
  const headline =
    delta === 0
      ? `Your body is tracking right at ${actualAge}.`
      : `Your body is reading about ${Math.abs(delta)} year${Math.abs(delta) === 1 ? "" : "s"} ${younger ? "younger" : "older"} than your age.`;

  return { available: true, actualAge, physioAge, deltaYears: delta, status, headline, factors, sampleDays: nCore };
}
