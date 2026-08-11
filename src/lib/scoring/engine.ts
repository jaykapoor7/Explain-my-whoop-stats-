import { DailySummary, NutritionTotals, PersonalBaseline, ScoreResult } from "../types";
import { calcSleep } from "./sleep";
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

/** Rolling 14-day personal baseline ending BEFORE index i (falls back to whole history start). */
function baselineAt(days: DailySummary[], i: number, scored: ScoredDay[]): PersonalBaseline {
  const from = Math.max(0, i - 14);
  const window = days.slice(from, Math.max(from + 1, i));
  const scoredWindow = scored.slice(from, Math.max(from + 1, i));
  return {
    hrvMs: mean(window.map((d) => d.hrv.rmssdMs)) || days[i].hrv.rmssdMs,
    rhrBpm: mean(window.map((d) => d.rhr.bpm)) || days[i].rhr.bpm,
    sleepMin: mean(window.map((d) => d.sleep.asleepMin)) || days[i].sleep.asleepMin,
    sleepEffPct: mean(window.map((d) => d.sleep.efficiencyPct)) || days[i].sleep.efficiencyPct,
    strain: mean(window.map((d) => countedActivities(d).reduce((s, a) => s + a.load, 0))) || 10,
    steps: mean(window.map((d) => d.steps)) || days[i].steps,
    energy: mean(scoredWindow.map((s) => s.energy.score)) || 55,
    recovery: mean(scoredWindow.map((s) => s.recovery.score)) || 55,
  };
}

/** Compute every day's scores in chronological order, wiring deltas + baselines. */
export function computeScoredDays(days: DailySummary[]): ScoredDay[] {
  const out: ScoredDay[] = [];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const baseline = baselineAt(days, i, out);
    const sleep = calcSleep(day).raw;
    const prevStrain = i > 0 ? out[i - 1].strain.score : 10;
    const recovery = calcRecovery(day, baseline, sleep.score, prevStrain);
    const strain = calcStrain(day);
    const energy = calcEnergy(day, baseline, sleep.score, recovery.score);

    // deltas vs yesterday + baselines for display
    if (i > 0) {
      sleep.deltaVsYesterday = sleep.score - out[i - 1].sleep.score;
      recovery.deltaVsYesterday = recovery.score - out[i - 1].recovery.score;
      strain.deltaVsYesterday = Math.round((strain.score - out[i - 1].strain.score) * 10) / 10;
      energy.deltaVsYesterday = energy.score - out[i - 1].energy.score;
    }
    sleep.baseline = Math.round(baseline.sleepMin / 6) / 10; // hours, for display
    recovery.baseline = Math.round(baseline.recovery);
    strain.baseline = Math.round(baseline.strain * 10) / 10;
    energy.baseline = Math.round(baseline.energy);

    out.push({ day, baseline, sleep, recovery, strain, energy, nutrition: nutritionTotals(day) });
  }
  return out;
}
