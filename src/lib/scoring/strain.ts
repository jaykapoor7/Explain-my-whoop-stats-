import { Activity, DailySummary, StrainScore } from "../types";
import { clamp } from "../format";
import { build, term, unavailable } from "./sleep";

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

/** Estimate the strain load of a session from its duration and average HR, on
 * the 0–21 scale. The single source of truth for "what would this cost me?" —
 * used when mapping logged workouts (manual + Google Health) AND by the Strain
 * page's session planner, so a projection matches what actually gets logged.
 *
 * Model: intensity is the fraction of your usable HR range (~85 easy floor →
 * ~180 ceiling); cardiac load grows faster than linearly with intensity
 * (exponent 1.5), accumulates over duration, then saturates toward the 21
 * ceiling. Calibrated WHOOP-style: an easy 30 min ≈ 3, a moderate 45 min ≈ 8,
 * a hard hour ≈ 14, an all-out hour ≈ 16, an all-out 90 min approaches 19. */
export function estimateActivityLoad(minutes: number, avgHr: number): number {
  if (!(minutes > 0)) return 0;
  // Unknown HR (some manual logs) → assume a moderate effort so duration counts.
  const intensity = avgHr > 0 ? clamp((avgHr - 85) / 95, 0, 1) : 0.5;
  const dose = minutes * Math.pow(intensity, 1.5);
  const load = 21 * (1 - Math.exp(-dose / 40));
  return Math.round(clamp(load, 0.3, 21) * 10) / 10;
}

export function countedActivities(day: DailySummary): Activity[] {
  return day.activities.filter(
    (a) => (a.confidence !== "low" && a.resolved !== "ignored") || a.resolved === "confirmed" || a.resolved === "edited"
  );
}

export function calcStrain(day: DailySummary): StrainScore {
  const counted = countedActivities(day);
  // No workout AND no step data has come through yet → there's nothing to score,
  // so show "no data" rather than a misleading 0.0.
  if (counted.length === 0 && day.steps <= 0) {
    return unavailable("strain", 21, "No movement yet", "Strain appears once your device records steps or a workout for the day.");
  }

  // Ambient load from all-day movement — scales smoothly from the first steps
  // (so a light day reads light, never a flat 0.0) and is capped so walking
  // alone can't dominate a real training day.
  const ambient = clamp(day.steps / 2500, 0, 5);
  const terms = [
    ...counted.map((a) =>
      term(a.type, a.load, `${a.durationMin}m${a.avgHr > 0 ? ` · avg ${a.avgHr} bpm` : ""}${a.calories > 0 ? ` · ${a.calories} kcal` : ""}`)
    ),
    ...(day.steps > 0 ? [term("Daily movement", ambient, `${day.steps.toLocaleString()} steps`)] : []),
  ];
  const total = clamp(counted.reduce((s, a) => s + a.load, 0) + ambient, 0, 21);
  const rounded = Math.round(total * 10) / 10;
  const ignoredLow = day.activities.filter((a) => a.confidence === "low" && a.resolved !== "confirmed").length;
  const lead = counted.length
    ? `${counted.length} counted ${counted.length === 1 ? "activity" : "activities"} for ${rounded.toFixed(1)} load.`
    : `A light day — daily movement only, for ${rounded.toFixed(1)} load.`;
  return build(
    "strain",
    21,
    rounded,
    terms,
    total >= 15 ? "All-out" : total >= 10 ? "Demanding" : total >= 6 ? "Moderate" : "Light",
    lead + (ignoredLow ? ` ${ignoredLow} unrecognized HR spike${ignoredLow > 1 ? "s" : ""} excluded pending your review.` : "")
  );
}
