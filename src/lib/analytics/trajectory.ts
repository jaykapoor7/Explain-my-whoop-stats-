import { Baselines } from "./state";
import { MetricKey, goodnessSign, metricDef } from "./metrics";
import { clamp, squash } from "./stats";

/**
 * Overall health trajectory — the slowest-moving read in CURA. It asks whether
 * the user's underlying profile is improving, holding, or slipping over weeks,
 * by combining the LONG-term (≈4-week) drift of the most reliable signals,
 * weighted by confidence. Deliberately sluggish: one bad week can't flip it.
 */

export interface TrajectoryDriver { key: MetricKey; label: string; contribution: number; movement: "improving" | "declining" | "stable" }

export interface HealthTrajectory {
  direction: "improving" | "stable" | "declining" | "uncertain";
  score: number | null;    // -1..1 net weighted long-term movement (health-oriented)
  confidence: number;
  drivers: TrajectoryDriver[];
}

// signals that genuinely track long-term health, with relative weights
const WEIGHTS: Partial<Record<MetricKey, number>> = {
  hrv: 1.0, rhr: 1.0, sleepMin: 0.7, sleepConsistency: 0.7, sleepEff: 0.5, steps: 0.5, deepMin: 0.4,
};

export function computeTrajectory(baselines: Baselines): HealthTrajectory {
  const drivers: TrajectoryDriver[] = [];
  let wsum = 0, netw = 0, confw = 0;

  for (const [key, w] of Object.entries(WEIGHTS) as [MetricKey, number][]) {
    const stat = baselines[key];
    if (!stat || stat.insufficient) continue;
    const g = goodnessSign(metricDef(key).dir) || 1;
    const oriented = stat.longTrend.zPerWeek * g; // + = healthier per week
    const weight = w * Math.max(0.15, stat.confidence);
    const movement = Math.abs(stat.longTrend.zPerWeek) < 0.3 ? "stable" : oriented > 0 ? "improving" : "declining";
    drivers.push({ key, label: metricDef(key).label, contribution: oriented * weight, movement });
    netw += oriented * weight;
    wsum += weight;
    confw += Math.max(0.15, stat.confidence) * w;
  }

  if (wsum === 0) return { direction: "uncertain", score: null, confidence: 0, drivers: [] };

  const score = clamp(squash(netw / wsum, 0.6), -1, 1);
  const confidence = clamp(confw / Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 0, 1);
  const direction = confidence < 0.3 ? "uncertain" : score > 0.15 ? "improving" : score < -0.15 ? "declining" : "stable";

  drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return { direction, score, confidence, drivers };
}
