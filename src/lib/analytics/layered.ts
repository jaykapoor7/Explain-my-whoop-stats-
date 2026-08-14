import type { BaselineStat } from "./baseline";
import { metricDef, MetricKey, goodnessSign } from "./metrics";

/**
 * NOW → TREND → TRAJECTORY.
 *
 * Every metric is read at three time depths so CURA never overreacts to one day:
 *   NOW        — today vs your personal baseline (a z-score, in your own spread)
 *   TREND      — the last ~1 week: which way it's leaning and whether that's real
 *   TRAJECTORY — the last ~month: is your underlying normal itself moving?
 * A bad NOW inside an improving TRAJECTORY is a very different story from a bad
 * NOW inside a declining one, and the copy layer leans on exactly that.
 */

export type Layer = "now" | "trend" | "trajectory";
export type Standing = "well-above" | "above" | "normal" | "below" | "well-below";
export type Movement = "improving" | "declining" | "stable" | "insufficient";

export interface LayeredMetric {
  key: MetricKey;
  label: string;
  confidence: number;
  now: { value: number | null; z: number | null; standing: Standing; sustainedDays: number };
  trend: { movement: Movement; zPerWeek: number };       // ~7d
  trajectory: { movement: Movement; zPerWeek: number; drift: BaselineStat["drift"] }; // ~28d
}

function standingOf(z: number | null): Standing {
  if (z == null) return "normal";
  if (z >= 2) return "well-above";
  if (z >= 0.75) return "above";
  if (z <= -2) return "well-below";
  if (z <= -0.75) return "below";
  return "normal";
}

/** Orient a raw slope by the metric's direction so "improving" always means
 * "getting healthier for you", whether the metric is higher- or lower-better. */
function movementOf(zPerWeek: number, key: MetricKey): Movement {
  const g = goodnessSign(metricDef(key).dir);
  const oriented = g === 0 ? zPerWeek : zPerWeek * g; // + = healthier
  if (Math.abs(zPerWeek) < 0.33) return "stable";
  return oriented > 0 ? "improving" : "declining";
}

export function layerMetric(key: MetricKey, stat: BaselineStat): LayeredMetric {
  const def = metricDef(key);
  if (stat.insufficient || !stat.available) {
    return {
      key, label: def.label, confidence: stat.confidence,
      now: { value: stat.current, z: null, standing: "normal", sustainedDays: 0 },
      trend: { movement: "insufficient", zPerWeek: 0 },
      trajectory: { movement: "insufficient", zPerWeek: 0, drift: "stable" },
    };
  }

  // Trajectory = is your underlying normal moving? The baseline-DRIFT detector
  // (recent-half vs older-half median over the full window) sees this far more
  // reliably than a 28-day slope, which a slow real change can hide inside its
  // own noise. Prefer drift; fall back to the long slope when drift is flat.
  const g = goodnessSign(def.dir);
  const driftMove: Movement =
    stat.drift === "stable" ? movementOf(stat.longTrend.zPerWeek, key)
      : (stat.drift === "rising" ? 1 : -1) * (g || 1) > 0 ? "improving" : "declining";

  return {
    key,
    label: def.label,
    confidence: stat.confidence,
    now: { value: stat.current, z: stat.z, standing: standingOf(stat.z), sustainedDays: stat.sustainedDays },
    trend: { movement: movementOf(stat.shortTrend.zPerWeek, key), zPerWeek: stat.shortTrend.zPerWeek },
    trajectory: { movement: driftMove, zPerWeek: stat.longTrend.zPerWeek, drift: stat.drift },
  };
}
