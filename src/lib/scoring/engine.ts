import { DailySummary, NutritionTotals, PersonalBaseline, ScoreResult } from "../types";
import { calcSleep } from "./sleep";
import { personalSleepNeed, sleepDebtMin } from "./sleep-coach";
import { calcStrain, countedActivities } from "./strain";
import { calcRecovery } from "./recovery";
import { calcEnergy } from "./energy";

/** A day with every derived score attached. The unit the whole UI consumes. */
export interface ScoredDay {
  day: DailySummary;
  baseline: PersonalBaseline;
  sleep: ScoreResult;
  recovery: ScoreResult;
  strain: ScoreResult;
  energy: ScoreResult;
  nutrition: NutritionTotals;
}

export function nutritionTotals(day: Pick<DailySummary, "meals">): NutritionTotals {
  const t: NutritionTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  for (const meal of day.meals) {
    for (const item of meal.items) {
      t.kcal += item.food.kcal * item.servings;
      t.protein += item.food.protein * item.servings;
      t.carbs += item.food.carbs * item.servings;
      t.fat += item.food.fat * item.servings;
      t.fiber += (item.food.fiber ?? 0) * item.servings;
      t.sugar += (item.food.sugar ?? 0) * item.servings;
      t.sodium += (item.food.sodium ?? 0) * item.servings;
    }
  }
  (Object.keys(t) as (keyof NutritionTotals)[]).forEach((k) => (t[k] = Math.round(t[k])));
  return t;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
// Baselines must average over days that actually have the metric — a day that
// didn't sync arrives as 0 and would otherwise drag the "typical" value down.
const meanPos = (xs: number[]) => mean(xs.filter((x) => x > 0));
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Robust day-to-day spread (MAD → σ), floored so a short/steady history can't
 * make every deviation look enormous. */
const robustSigma = (xs: number[], centre: number, floorFrac: number): number => {
  if (xs.length < 3) return Math.max(centre * floorFrac, 1);
  const med = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - med))) * 1.4826;
  return Math.max(mad, centre * floorFrac, 1);
};

/** Rolling 14-day personal baseline ending BEFORE index i (falls back to whole history start). */
function baselineAt(days: DailySummary[], i: number, scored: ScoredDay[]): PersonalBaseline {
  const from = Math.max(0, i - 14);
  const window = days.slice(from, Math.max(from + 1, i));
  const scoredWindow = scored.slice(from, Math.max(from + 1, i));
  const hrvVals = window.map((d) => d.hrv.rmssdMs).filter((x) => x > 0);
  const rhrVals = window.map((d) => d.rhr.bpm).filter((x) => x > 0);
  const hrvMs = meanPos(window.map((d) => d.hrv.rmssdMs)) || days[i].hrv.rmssdMs || 45;
  const rhrBpm = meanPos(window.map((d) => d.rhr.bpm)) || days[i].rhr.bpm || 60;
  const hrvSigma = robustSigma(hrvVals, hrvMs, 0.06);
  const rhrSigma = robustSigma(rhrVals, rhrBpm, 0.03);
  // Recent multi-day autonomic trajectory: how the last few days' HRV sit vs the
  // fuller baseline, in personal-σ units. Drives an adaptive starting point.
  const recentHrv = window.slice(-5).map((d) => d.hrv.rmssdMs).filter((x) => x > 0);
  const hrvSustain = recentHrv.length >= 2 ? (mean(recentHrv) - hrvMs) / hrvSigma : 0;
  // Personal sleep architecture: your own typical deep / REM share.
  const deepShares = window.map((d) => (d.sleep.asleepMin > 0 ? d.sleep.stages.deep / d.sleep.asleepMin : NaN)).filter((x) => x > 0 && isFinite(x));
  const remShares = window.map((d) => (d.sleep.asleepMin > 0 ? d.sleep.stages.rem / d.sleep.asleepMin : NaN)).filter((x) => x > 0 && isFinite(x));
  return {
    hrvMs,
    rhrBpm,
    sleepMin: meanPos(window.map((d) => d.sleep.asleepMin)) || days[i].sleep.asleepMin || 450,
    sleepEffPct: meanPos(window.map((d) => d.sleep.efficiencyPct)) || days[i].sleep.efficiencyPct || 90,
    strain: mean(window.map((d) => countedActivities(d).reduce((s, a) => s + a.load, 0))) || 10,
    steps: meanPos(window.map((d) => d.steps)) || days[i].steps,
    energy: mean(scoredWindow.filter((s) => s.energy.available !== false).map((s) => s.energy.score)) || 55,
    recovery: mean(scoredWindow.filter((s) => s.recovery.available !== false).map((s) => s.recovery.score)) || 55,
    sleep: mean(scoredWindow.filter((s) => s.sleep.available !== false).map((s) => s.sleep.score)) || 72,
    hrvSigma,
    rhrSigma,
    hrvSustain,
    deepPct: deepShares.length >= 3 ? mean(deepShares) : undefined,
    remPct: remShares.length >= 3 ? mean(remShares) : undefined,
  };
}

/** Compute every day's scores in chronological order, wiring deltas + baselines.
 * `opts.maxHr` personalises the strain scale (age-derived); resting HR comes
 * from each day's rolling personal baseline. */
export function computeScoredDays(days: DailySummary[], opts: { maxHr?: number } = {}): ScoredDay[] {
  const out: ScoredDay[] = [];
  for (let i = 0; i < days.length; i++) {
    const raw = days[i];
    // Fill in a personalised sleep need + rolling debt from history, so the
    // Sleep score's debt term and the coach read real numbers (connectors only
    // ship placeholders).
    const need = personalSleepNeed(days.slice(0, i + 1));
    const debt = sleepDebtMin(days.slice(0, i + 1), need);
    const day: DailySummary =
      raw.sleep.asleepMin > 0 || raw.sleep.inBedMin > 0
        ? { ...raw, sleep: { ...raw.sleep, needMin: need, debtMin: debt } }
        : raw;
    const baseline = baselineAt(days, i, out);
    const sleep = calcSleep(day, baseline).raw;
    const prevStrain = i > 0 ? out[i - 1].strain.score : 10;
    const recovery = calcRecovery(day, baseline, sleep, prevStrain);
    const strain = calcStrain(day, { restHr: baseline.rhrBpm, maxHr: opts.maxHr });
    const energy = calcEnergy(day, baseline, sleep, recovery, prevStrain);

    // deltas vs yesterday + baselines for display (only between days that both have the pillar)
    if (i > 0) {
      const prev = out[i - 1];
      if (sleep.available !== false && prev.sleep.available !== false) sleep.deltaVsYesterday = sleep.score - prev.sleep.score;
      if (recovery.available !== false && prev.recovery.available !== false) recovery.deltaVsYesterday = recovery.score - prev.recovery.score;
      strain.deltaVsYesterday = Math.round((strain.score - prev.strain.score) * 10) / 10;
      if (energy.available !== false && prev.energy.available !== false) energy.deltaVsYesterday = energy.score - prev.energy.score;
    }
    sleep.baseline = Math.round(baseline.sleepMin / 6) / 10; // hours, for display
    recovery.baseline = Math.round(baseline.recovery);
    strain.baseline = Math.round(baseline.strain * 10) / 10;
    energy.baseline = Math.round(baseline.energy);

    out.push({ day, baseline, sleep, recovery, strain, energy, nutrition: nutritionTotals(day) });
  }
  return out;
}
