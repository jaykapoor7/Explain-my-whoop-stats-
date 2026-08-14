import type { DailySummary } from "../types";
import { MetricKey, metricDef, series } from "./metrics";
import { clamp, spearman } from "./stats";

/**
 * Cross-metric relationship engine. Discovers, from THIS user's history, which
 * signals tend to move together — optionally with a lag (sleep tonight →
 * recovery tomorrow). Uses Spearman rank correlation (robust to outliers and
 * monotonic-but-curved links) and only surfaces a pairing when the sample is
 * big enough and the association is strong enough. Never asserts causation.
 */

export interface Relationship {
  a: MetricKey;
  b: MetricKey;
  lag: number;         // days between A and B (0 = same day)
  r: number;           // Spearman rho in [-1,1]
  n: number;           // paired observations
  confidence: number;  // 0..1 (strength × sample adequacy)
  direction: "positive" | "negative";
}

interface Candidate { a: MetricKey; b: MetricKey; lag: number }

// Physiologically plausible pairs worth testing — we still only report the ones
// the data actually supports.
const CANDIDATES: Candidate[] = [
  { a: "sleepMin", b: "hrv", lag: 1 },
  { a: "sleepMin", b: "rhr", lag: 1 },
  { a: "sleepConsistency", b: "hrv", lag: 1 },
  { a: "deepMin", b: "hrv", lag: 1 },
  { a: "strainLoad", b: "hrv", lag: 1 },
  { a: "strainLoad", b: "rhr", lag: 1 },
  { a: "steps", b: "sleepMin", lag: 0 },
  { a: "sleepMin", b: "sleepEff", lag: 0 },
  { a: "activeCalories", b: "sleepMin", lag: 0 },
  { a: "rhr", b: "hrv", lag: 0 },
  { a: "sleepHr", b: "hrv", lag: 0 },
];

function pairedSpearman(days: DailySummary[], a: MetricKey, b: MetricKey, lag: number): { r: number; n: number } | null {
  const A = series(days, a);
  const B = series(days, b);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < days.length - lag; i++) {
    const x = A[i];
    const y = B[i + lag];
    if (x == null || y == null) continue;
    xs.push(x);
    ys.push(y);
  }
  if (xs.length < 12) return null;
  const r = spearman(xs, ys);
  return isFinite(r) ? { r, n: xs.length } : null;
}

export function discoverRelationships(days: DailySummary[], minAbsR = 0.3): Relationship[] {
  const out: Relationship[] = [];
  for (const c of CANDIDATES) {
    const res = pairedSpearman(days, c.a, c.b, c.lag);
    if (!res || Math.abs(res.r) < minAbsR) continue;
    const confidence = clamp(Math.abs(res.r), 0, 1) * clamp(res.n / 25, 0, 1);
    out.push({ a: c.a, b: c.b, lag: c.lag, r: res.r, n: res.n, confidence, direction: res.r > 0 ? "positive" : "negative" });
  }
  return out.sort((x, y) => y.confidence - x.confidence);
}

/** Human phrase for a relationship, staying strictly observational. */
export function describeRelationship(rel: Relationship): { title: string; detail: string } {
  const A = metricDef(rel.a);
  const B = metricDef(rel.b);
  const when = rel.lag > 0 ? "the next day" : "the same day";
  const moreB = rel.direction === "positive" ? "higher" : "lower";
  return {
    title: `More ${A.label} → ${moreB} ${B.label}`,
    detail: `When your ${A.label} runs higher, your ${B.label} ${when} tends to run ${moreB} (rho ${rel.r.toFixed(2)} across ${rel.n} paired days). An association in your data, not proof of cause.`,
  };
}
