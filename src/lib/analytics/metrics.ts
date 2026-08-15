import type { DailySummary } from "../types";
import { countedActivities } from "../scoring/strain";

/**
 * The device-agnostic metric layer. Every connector (Google Health, Oura, WHOOP,
 * Fitbit, Polar, manual) already normalises into DailySummary, so this is the one
 * place that maps that common schema into named, directional numeric series.
 *
 * Contract: a getter returns `null` when the metric wasn't measured that day.
 * NEVER 0 — a missing HRV is not an HRV of zero. Everything downstream filters
 * nulls out, so "insufficient data" stays distinct from "a low value".
 */

export type Direction = "higherBetter" | "lowerBetter" | "neutral";

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  decimals: number;
  dir: Direction;
  /** Minimum valid observations before a personal baseline is trustworthy. */
  minObs: number;
  get: (d: DailySummary) => number | null;
}

const pos = (v: number | undefined | null): number | null => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);

export const METRIC_DEFS = [
  { key: "hrv", label: "overnight HRV", unit: "ms", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.hrv.rmssdMs) },
  { key: "rhr", label: "resting heart rate", unit: "bpm", decimals: 0, dir: "lowerBetter", minObs: 7, get: (d) => pos(d.rhr.bpm) },
  { key: "sleepMin", label: "sleep duration", unit: "min", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.sleep.asleepMin) },
  { key: "sleepEff", label: "sleep efficiency", unit: "%", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.sleep.efficiencyPct) },
  { key: "sleepConsistency", label: "sleep consistency", unit: "%", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.sleep.consistencyPct) },
  { key: "deepMin", label: "deep sleep", unit: "min", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.sleep.stages.deep) },
  { key: "remMin", label: "REM sleep", unit: "min", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.sleep.stages.rem) },
  { key: "sleepHr", label: "sleeping heart rate", unit: "bpm", decimals: 0, dir: "lowerBetter", minObs: 7, get: (d) => pos(d.sleep.sleepHrBpm) },
  { key: "steps", label: "daily steps", unit: "", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.steps) },
  { key: "activeCalories", label: "active calories", unit: "kcal", decimals: 0, dir: "higherBetter", minObs: 7, get: (d) => pos(d.activeCalories) },
  { key: "strainLoad", label: "activity load", unit: "", decimals: 1, dir: "neutral", minObs: 7, get: (d) => {
      const acts = countedActivities(d);
      const hasSteps = typeof d.steps === "number" && isFinite(d.steps) && d.steps > 0;
      if (acts.length === 0 && !hasSteps) return null; // no movement data at all
      // Mirror the strain score: counted-workout load PLUS all-day movement from
      // steps. Without the ambient term a step-only active day reads as zero load,
      // making "load" look like it's falling on the very days you moved more.
      const ambient = hasSteps ? Math.min(5, d.steps / 2500) : 0;
      return acts.reduce((s, a) => s + a.load, 0) + ambient;
    } },
] as const satisfies readonly MetricDef[];

export type MetricKey =
  | "hrv" | "rhr" | "sleepMin" | "sleepEff" | "sleepConsistency"
  | "deepMin" | "remMin" | "sleepHr" | "steps" | "activeCalories" | "strainLoad";

export const metricDef = (key: MetricKey): MetricDef => METRIC_DEFS.find((m) => m.key === key)!;

/** Aligned series for a metric across days — `null` where the day lacks it. */
export const series = (days: DailySummary[], key: MetricKey): (number | null)[] => {
  const g = metricDef(key).get;
  return days.map(g);
};

/** How much this metric's direction wants a value to move: +1 if higher is
 * better, -1 if lower is better, 0 if neutral. Lets the engine turn a raw
 * deviation into a signed "better/worse for you" contribution. */
export const goodnessSign = (dir: Direction): number => (dir === "higherBetter" ? 1 : dir === "lowerBetter" ? -1 : 0);
