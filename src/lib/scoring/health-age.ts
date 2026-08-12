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

// Rough adult age-expected references (placeholders, not clinical).
const expectedHrv = (age: number) => clamp(68 - (age - 20) * 0.85, 18, 80); // ms, declines with age
const expectedRhr = (age: number) => clamp(58 + Math.max(0, age - 30) * 0.06, 55, 68); // bpm

export function ageFromBirthYear(birthYear: number | undefined, today = new Date()): number | undefined {
  if (!birthYear) return undefined;
  const age = today.getFullYear() - birthYear;
  return age >= 13 && age <= 100 ? age : undefined;
}

export function calcHealthAge(days: ScoredDay[], actualAge: number | undefined): HealthAgeResult {
  const base: HealthAgeResult = {
    available: false, actualAge: actualAge ?? 0, physioAge: 0, deltaYears: 0,
    status: "No data", headline: "", factors: [], sampleDays: 0,
  };
  if (!actualAge) return { ...base, reason: "set-age" };

  const recent = days.slice(-21).map((s) => s.day);
  const hrv = mean(recent.filter((d) => d.hrv.rmssdMs > 0).map((d) => d.hrv.rmssdMs));
  const rhr = mean(recent.filter((d) => d.rhr.bpm > 0).map((d) => d.rhr.bpm));
  const sleepMin = mean(recent.filter((d) => d.sleep.asleepMin > 0).map((d) => d.sleep.asleepMin));
  const steps = mean(recent.filter((d) => d.steps > 0).map((d) => d.steps));
  const nCore = recent.filter((d) => d.hrv.rmssdMs > 0 || d.rhr.bpm > 0).length;
  if (nCore < 5) return { ...base, actualAge, reason: "need-data" };

  const factors: AgeFactor[] = [];
  const push = (label: string, years: number, detail: string) => {
    const y = clamp(years, -6, 6);
    if (Math.abs(y) >= 0.3) factors.push({ label, years: y, detail });
    return y;
  };

  let adj = 0;
  if (isFinite(hrv)) adj += push("HRV", -(hrv - expectedHrv(actualAge)) * 0.11, `${Math.round(hrv)} ms vs ~${Math.round(expectedHrv(actualAge))} expected for your age`);
  if (isFinite(rhr)) adj += push("Resting heart rate", (rhr - expectedRhr(actualAge)) * 0.32, `${Math.round(rhr)} bpm vs ~${Math.round(expectedRhr(actualAge))} expected`);
  if (isFinite(sleepMin)) {
    const h = sleepMin / 60;
    adj += push("Sleep", (Math.abs(h - 7.75) - 0.6) * 1.1, `${h.toFixed(1)}h average per night`);
  }
  if (isFinite(steps)) adj += push("Daily activity", -((steps - 7000) / 3500) * 1.1, `${Math.round(steps).toLocaleString()} steps/day`);

  const physioAge = Math.round(clamp(actualAge + adj, 13, 100));
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
