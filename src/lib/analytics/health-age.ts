import type { DailySummary } from "../types";
import { baselineFor } from "./baseline";
import { series } from "./metrics";
import { Baselines } from "./state";
import { computeResilience } from "./resilience";
import { computeTrajectory } from "./trajectory";
import { clamp } from "./stats";

/**
 * Trajectory-based Health Age. NOT a single gimmick formula — it reads several
 * longitudinal dimensions off the personal-baseline layer (robust medians, not
 * one day), blends them against gentle age-expected references, folds in
 * physiological resilience, and reports a confidence plus which factors help or
 * hurt and which way the whole thing is trending. Modular so the weighting can
 * improve without touching the app. Wellness estimate, not a clinical age.
 */

const clampN = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
// healthy-adult population medians (kept in step with the classic estimator)
const expectedHrv = (age: number) => clampN(52 - (age - 25) * 0.5, 24, 58);
const expectedRhr = (age: number) => clampN(62 + Math.max(0, age - 35) * 0.05, 60, 68);

export interface AgeContributor { label: string; years: number; detail: string }

export interface HealthAgeModel {
  available: boolean;
  reason?: string;
  actualAge: number;
  physioAge: number;
  deltaYears: number;
  confidence: number;
  confidenceLabel: "high" | "moderate" | "low" | "insufficient";
  trajectory: "improving" | "stable" | "declining" | "uncertain";
  trajectoryDeltaYears: number; // approx change over ~8 weeks (negative = getting younger)
  positives: AgeContributor[];
  negatives: AgeContributor[];
  headline: string;
}

function contribute(list: AgeContributor[], label: string, years: number, detail: string) {
  const y = clampN(years, -5, 5);
  if (Math.abs(y) >= 0.3) list.push({ label, years: y, detail });
  return y;
}

/** Build baselines for the Health Age inputs as of the last day. */
function ageBaselines(days: DailySummary[]): Baselines {
  const keys = ["hrv", "rhr", "sleepMin", "sleepEff", "sleepConsistency", "steps"] as const;
  const b: Baselines = {};
  for (const k of keys) {
    b[k] = baselineFor(series(days, k), k === "rhr" ? "lowerBetter" : "higherBetter", { windowDays: 90 });
    b[k]!.key = k;
  }
  return b;
}

export function computeHealthAge(days: DailySummary[], actualAge: number | undefined): HealthAgeModel {
  const base: HealthAgeModel = {
    available: false, actualAge: actualAge ?? 0, physioAge: 0, deltaYears: 0, confidence: 0,
    confidenceLabel: "insufficient", trajectory: "uncertain", trajectoryDeltaYears: 0,
    positives: [], negatives: [], headline: "",
  };
  if (!actualAge) return { ...base, reason: "set-age" };

  const b = ageBaselines(days);
  const core = [b.hrv, b.rhr].filter((s) => s && !s.insufficient);
  if (core.length === 0) return { ...base, actualAge, reason: "need-data" };

  const contributors: AgeContributor[] = [];
  let adj = 0;
  const med = (k: keyof Baselines) => (b[k] && !b[k]!.insufficient ? b[k]!.median : NaN);

  const hrv = med("hrv");
  if (isFinite(hrv)) adj += contribute(contributors, "HRV", -(hrv - expectedHrv(actualAge)) * 0.07, `Your typical ${Math.round(hrv)} ms vs ~${Math.round(expectedHrv(actualAge))} for your age`);
  const rhr = med("rhr");
  if (isFinite(rhr)) adj += contribute(contributors, "Resting heart rate", (rhr - expectedRhr(actualAge)) * 0.22, `Your typical ${Math.round(rhr)} bpm vs ~${Math.round(expectedRhr(actualAge))}`);
  const sleepH = med("sleepMin") / 60;
  if (isFinite(sleepH)) adj += contribute(contributors, "Sleep duration", Math.abs(sleepH - 7.5) * 0.9 - 0.4, `You typically sleep ${sleepH.toFixed(1)}h`);
  const eff = med("sleepEff");
  if (isFinite(eff)) adj += contribute(contributors, "Sleep efficiency", -(eff - 85) * 0.07, `${Math.round(eff)}% typical efficiency`);
  const cons = med("sleepConsistency");
  if (isFinite(cons)) adj += contribute(contributors, "Sleep consistency", -(cons - 78) * 0.04, `${Math.round(cons)}% schedule regularity`);
  const steps = med("steps");
  if (isFinite(steps)) adj += contribute(contributors, "Daily activity", -((steps - 6500) / 4000) * 1.0, `${Math.round(steps).toLocaleString()} steps on a typical day`);

  // Physiological resilience — faster return to baseline reads younger.
  const res = computeResilience(days);
  if (res.available && res.score != null) adj += contribute(contributors, "Resilience", -(res.score - 60) * 0.03, `Bounce-back index ${res.score}/100`);
  // Autonomic stability — a steadier HRV baseline reads younger.
  if (b.hrv && !b.hrv.insufficient && isFinite(b.hrv.volatility)) adj += contribute(contributors, "Autonomic stability", (b.hrv.volatility - 0.18) * 6, `${Math.round(b.hrv.volatility * 100)}% night-to-night HRV swing`);

  const physioAge = Math.round(clampN(actualAge + clampN(adj, -12, 12), 13, 100));
  const deltaYears = physioAge - actualAge;

  // Trajectory: net long-term movement of health signals → approx years/8wk.
  const traj = computeTrajectory(ageBaselines(days));
  const trajectoryDeltaYears = traj.score == null ? 0 : Math.round(-traj.score * 2 * 10) / 10;

  const confidence = clamp(core.reduce((s, x) => s + (x!.confidence), 0) / Math.max(1, core.length), 0, 1);
  const confidenceLabel = confidence >= 0.75 ? "high" : confidence >= 0.45 ? "moderate" : confidence > 0 ? "low" : "insufficient";

  const positives = contributors.filter((c) => c.years < 0).sort((a, c) => a.years - c.years);
  const negatives = contributors.filter((c) => c.years > 0).sort((a, c) => c.years - a.years);
  const younger = deltaYears < 0;
  const headline = deltaYears === 0
    ? `Your body is tracking right at ${actualAge}.`
    : `Your body reads about ${Math.abs(deltaYears)} year${Math.abs(deltaYears) === 1 ? "" : "s"} ${younger ? "younger" : "older"} than your age.`;

  return {
    available: true, actualAge, physioAge, deltaYears, confidence, confidenceLabel,
    trajectory: traj.direction, trajectoryDeltaYears, positives, negatives, headline,
  };
}
