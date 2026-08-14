import type { DailySummary } from "../types";
import { MetricKey, metricDef, series } from "./metrics";
import type { Confidence } from "./baseline";
import { mean, median, percentile, robustSigma, spearman, clamp } from "./stats";

/**
 * Personal response modeling. Beyond "what's normal for you" — "how does YOUR
 * body respond to X?". We estimate the association between a driver (a metric,
 * or a logged behaviour like alcohol) and a downstream outcome, using only
 * comparable days, requiring a real sample, reporting an effect size and a
 * confidence, and always in observational language. Correlation, never cause.
 */

export interface ResponseEstimate {
  driver: string;
  outcome: MetricKey;
  lag: number;
  n: number;             // comparable observations used
  highMean: number;      // outcome when driver high / behaviour present
  lowMean: number;       // outcome when driver low / behaviour absent
  diff: number;          // high - low, raw outcome units
  pct: number;           // diff as % of low
  effect: number;        // |diff| / pooled spread (Cohen-d-ish)
  rho: number | null;    // Spearman monotonic strength (numeric drivers only)
  confidence: Confidence;
  direction: "increases" | "decreases" | "flat";
}

export type DriverSpec =
  | { kind: "metric"; key: MetricKey }
  | { kind: "behavior"; id: string; label: string; present: (d: DailySummary) => boolean };

const confOf = (n: number, effect: number): Confidence => {
  const s = clamp(n / 20, 0, 1) * clamp(effect / 0.8, 0, 1);
  return n < 8 ? "insufficient" : s >= 0.6 ? "high" : s >= 0.3 ? "moderate" : "low";
};

/** Split into high/low groups (numeric: above/below personal median with a dead
 * zone; behaviour: present/absent) and compare the lagged outcome. */
export function estimateResponse(days: DailySummary[], driver: DriverSpec, outcome: MetricKey, lag = 1): ResponseEstimate | null {
  const out = series(days, outcome);
  const hi: number[] = [];
  const lo: number[] = [];
  const px: number[] = []; // paired driver value (numeric only)
  const py: number[] = [];

  let driverVals: (number | null)[] = [];
  let p33 = NaN, p66 = NaN;
  if (driver.kind === "metric") {
    driverVals = series(days, driver.key);
    const valid = driverVals.filter((v): v is number => v != null);
    if (valid.length < 10) return null;
    p33 = percentile(valid, 0.34);
    p66 = percentile(valid, 0.66);
  }

  for (let i = 0; i < days.length - lag; i++) {
    const y = out[i + lag];
    if (y == null) continue;
    if (driver.kind === "behavior") {
      (driver.present(days[i]) ? hi : lo).push(y);
    } else {
      const x = driverVals[i];
      if (x == null) continue;
      px.push(x); py.push(y);
      if (x >= p66) hi.push(y);
      else if (x <= p33) lo.push(y);
    }
  }
  if (hi.length < 4 || lo.length < 4) return null;

  const highMean = mean(hi), lowMean = mean(lo);
  const diff = highMean - lowMean;
  const pooled = robustSigma([...hi, ...lo]) || Math.abs(median([...hi, ...lo])) * 0.1 || 1;
  const effect = Math.abs(diff) / pooled;
  const n = hi.length + lo.length;
  const rho = driver.kind === "metric" && px.length >= 10 ? spearman(px, py) : null;
  const direction = Math.abs(diff) < 0.15 * pooled ? "flat" : diff > 0 ? "increases" : "decreases";

  return {
    driver: driver.kind === "metric" ? metricDef(driver.key).label : driver.label,
    outcome, lag, n, highMean, lowMean, diff, pct: lowMean ? (diff / lowMean) * 100 : 0,
    effect, rho, confidence: confOf(n, effect), direction,
  };
}

export interface ResponseCurvePoint { bin: string; driverMid: number; outcome: number; n: number }

/** Bin a numeric driver into quantile bands and read the outcome per band — this
 * is how CURA can notice "energy climbs from 5.5→7h of sleep then flattens". */
export function responseCurve(days: DailySummary[], driver: MetricKey, outcome: MetricKey, lag = 0, bins = 4): ResponseCurvePoint[] {
  const dv = series(days, driver);
  const ov = series(days, outcome);
  const pairs: { x: number; y: number }[] = [];
  for (let i = 0; i < days.length - lag; i++) {
    const x = dv[i], y = ov[i + lag];
    if (x != null && y != null) pairs.push({ x, y });
  }
  if (pairs.length < bins * 4) return [];
  const xs = pairs.map((p) => p.x);
  const edges = Array.from({ length: bins + 1 }, (_, k) => percentile(xs, k / bins));
  const dl = metricDef(driver);
  const out: ResponseCurvePoint[] = [];
  for (let b = 0; b < bins; b++) {
    const inBin = pairs.filter((p) => p.x >= edges[b] && (b === bins - 1 ? p.x <= edges[b + 1] : p.x < edges[b + 1]));
    if (inBin.length < 3) continue;
    out.push({
      bin: `${Math.round(edges[b])}–${Math.round(edges[b + 1])}${dl.unit}`,
      driverMid: median(inBin.map((p) => p.x)),
      outcome: median(inBin.map((p) => p.y)),
      n: inBin.length,
    });
  }
  return out;
}
