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

/** Age-predicted maximum heart rate (Tanaka: 208 − 0.7·age), which personalises
 * the top of the strain scale. Falls back to a sensible default when age is
 * unknown, and is clamped to a physiological range. */
export function maxHrFromAge(age?: number): number {
  if (!age || !isFinite(age) || age < 10 || age > 100) return 190;
  return Math.round(clamp(208 - 0.7 * age, 160, 205));
}

/** Estimate the strain load of a session on the 0–21 scale — PERSONALISED to
 * the individual via heart-rate reserve (Karvonen). The single source of truth
 * for "what would this cost me?": used when mapping logged workouts AND by the
 * Strain page's session planner, so a projection matches what gets logged.
 *
 * Intensity is where the session's average HR sits in YOUR OWN usable range —
 * from your resting HR (0%) to your max HR (100%). The same 150 bpm is a hard
 * effort for someone with rest 70 / max 175, but only moderate for an athlete
 * with rest 48 / max 198. Cardiac load then grows faster than linearly with
 * intensity (exponent 1.5), accumulates over duration, and saturates toward the
 * 21 ceiling. Calibrated so a hard hour ≈ 14 and an all-out hour ≈ 16. */
export function estimateActivityLoad(minutes: number, avgHr: number, restHr = 60, maxHr = 185): number {
  if (!(minutes > 0)) return 0;
  const rest = clamp(restHr > 0 ? restHr : 60, 35, 90);
  const max = Math.max(maxHr > 0 ? maxHr : 185, rest + 50); // guard a sane reserve
  // Heart-rate reserve fraction; unknown HR (some manual logs) → moderate effort.
  const intensity = avgHr > 0 ? clamp((avgHr - rest) / (max - rest), 0, 1) : 0.5;
  const dose = minutes * Math.pow(intensity, 1.5);
  const load = 21 * (1 - Math.exp(-dose / 40));
  return Math.round(clamp(load, 0.3, 21) * 10) / 10;
}

export function countedActivities(day: DailySummary): Activity[] {
  return day.activities.filter(
    (a) => (a.confidence !== "low" && a.resolved !== "ignored") || a.resolved === "confirmed" || a.resolved === "edited"
  );
}

export function calcStrain(day: DailySummary, hr: { restHr?: number; maxHr?: number } = {}): StrainScore {
  const counted = countedActivities(day);
  // No workout AND no step data has come through yet → there's nothing to score,
  // so show "no data" rather than a misleading 0.0.
  if (counted.length === 0 && day.steps <= 0) {
    return unavailable("strain", 21, "No movement yet", "Strain appears once your device records steps or a workout for the day.");
  }

  // Personalise each activity's load from YOUR heart-rate reserve when we have an
  // average HR, so the same workout scores relative to your own fitness. Fall
  // back to the load the connector supplied only when HR is missing.
  const loadOf = (a: Activity) => (a.avgHr > 0 ? estimateActivityLoad(a.durationMin, a.avgHr, hr.restHr, hr.maxHr) : a.load);

  // Ambient load from all-day movement — scales smoothly from the first steps
  // (so a light day reads light, never a flat 0.0) and is capped so walking
  // alone can't dominate a real training day.
  const ambient = clamp(day.steps / 2500, 0, 5);
  const terms = [
    ...counted.map((a) =>
      term(a.type, loadOf(a), `${a.durationMin}m${a.avgHr > 0 ? ` · avg ${a.avgHr} bpm` : ""}${a.calories > 0 ? ` · ${a.calories} kcal` : ""}`)
    ),
    ...(day.steps > 0 ? [term("Daily movement", ambient, `${day.steps.toLocaleString()} steps`)] : []),
  ];
  const total = clamp(counted.reduce((s, a) => s + loadOf(a), 0) + ambient, 0, 21);
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
