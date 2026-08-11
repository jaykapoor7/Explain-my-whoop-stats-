import { Activity, DailySummary, StrainScore } from "../types";
import { clamp } from "../format";
import { build, term } from "./sleep";

/**
 * StrainCalculator — deterministic mock on a 0..21 scale.
 * Strain = sum of per-activity load + a small ambient-movement term from steps.
 *
 * CRITICAL RULE: low-confidence activity (unrecognized HR spikes) contributes
 * NOTHING unless the user explicitly confirms it. This is what keeps a stress
 * spike or a hot shower from becoming "HIIT".
 *
 * NOTE: placeholder weights. The finished algorithm will be designed separately.
 */

export function countedActivities(day: DailySummary): Activity[] {
  return day.activities.filter(
    (a) => (a.confidence !== "low" && a.resolved !== "ignored") || a.resolved === "confirmed" || a.resolved === "edited"
  );
}

export function calcStrain(day: DailySummary): StrainScore {
  const counted = countedActivities(day);
  const ambient = clamp((day.steps - 4000) / 4500, 0, 2.2);
  const terms = [
    ...counted.map((a) =>
      term(a.type, a.load, `${a.durationMin}m · avg ${a.avgHr} bpm · ${a.calories} kcal`)
    ),
    term("Daily movement", ambient, `${day.steps.toLocaleString()} steps`),
  ];
  const total = clamp(counted.reduce((s, a) => s + a.load, 0) + ambient, 0, 21);
  const ignoredLow = day.activities.filter((a) => a.confidence === "low" && a.resolved !== "confirmed").length;
  return build(
    "strain",
    21,
    Math.round(total * 10) / 10,
    terms,
    total >= 15 ? "All-out" : total >= 10 ? "Demanding" : total >= 6 ? "Moderate" : "Light",
    `${counted.length} counted ${counted.length === 1 ? "activity" : "activities"} for ${(Math.round(total * 10) / 10).toFixed(1)} load.` +
      (ignoredLow ? ` ${ignoredLow} unrecognized HR spike${ignoredLow > 1 ? "s" : ""} excluded pending your review.` : "")
  );
}
