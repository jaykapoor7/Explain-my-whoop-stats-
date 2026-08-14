import { clamp, ewma, mad, median, percentile, robustSigma, theilSen } from "./stats";
import { Direction, goodnessSign } from "./metrics";

/**
 * Personal Baseline Engine.
 *
 * For one metric it answers: what is normal FOR THIS USER, and how far is today
 * from that — measured in the user's own day-to-day variability, not a textbook
 * range. HRV 55 ms means nothing until we know your normal is 68 ± 6; then a
 * sustained 55 is a real signal, while for someone whose normal is 54 ± 5 it's
 * just Tuesday.
 */

export type Trend = "improving" | "declining" | "stable";
export type Drift = "rising" | "falling" | "stable";
export type Confidence = "high" | "moderate" | "low" | "insufficient";

export interface TrendSlope {
  perDay: number;   // robust slope in raw units/day
  perWeek: number;  // perDay * 7
  zPerWeek: number; // slope expressed in personal sigmas per week (meaningfulness)
  dir: Trend;
}

export interface BaselineStat {
  key: string;
  dir: Direction;
  available: boolean;
  /** true = not enough history yet; treat as "still learning", NOT as normal. */
  insufficient: boolean;
  reason?: string;

  current: number | null;
  n: number;          // valid observations in the window
  spanDays: number;   // calendar span those observations cover

  median: number;     // the personal baseline (robust centre)
  ewma: number;       // recency-weighted centre
  sigma: number;      // robust sigma (personal day-to-day spread)
  p25: number;
  p75: number;

  deviation: number | null;      // current - median, raw units (signed)
  goodnessDeviation: number | null; // deviation oriented so + = better for you
  z: number | null;              // robust z-score of today vs baseline
  /** how many recent days have sat beyond ±1 personal sigma in the "worse" dir */
  sustainedDays: number;

  shortTrend: TrendSlope; // ~7d
  longTrend: TrendSlope;  // ~28d
  volatility: number;     // robust CV (sigma / |median|)
  drift: Drift;           // is the baseline itself moving?

  confidence: number;     // 0..1
  confidenceLabel: Confidence;
}

export interface BaselineOptions {
  windowDays?: number; // how far back the baseline looks (default 60)
  minObs?: number;     // min valid obs before we trust it (metric default otherwise)
  halfLife?: number;   // EWMA half-life in days (default 10)
}

const emptySlope = (): TrendSlope => ({ perDay: 0, perWeek: 0, zPerWeek: 0, dir: "stable" });

function slope(obs: { t: number; v: number }[], span: number): TrendSlope {
  const use = obs.slice(-span);
  if (use.length < 4) return emptySlope();
  const t0 = use[0].t;
  const xs = use.map((o) => o.t - t0);
  const ys = use.map((o) => o.v);
  const perDay = theilSen(xs, ys);
  if (!isFinite(perDay)) return emptySlope();
  // Significance is measured against DETRENDED noise, not total spread — a
  // strong trend inflates total spread and would otherwise hide itself.
  const intercept = median(ys.map((y, k) => y - perDay * xs[k]));
  const resid = ys.map((y, k) => y - (perDay * xs[k] + intercept));
  const rs = robustSigma(resid);
  const denom = isFinite(rs) && rs > 0 ? rs : Math.abs(median(ys)) * 0.05 || 1;
  const perWeek = perDay * 7;
  const zPerWeek = perWeek / denom;
  const dir: Trend = Math.abs(zPerWeek) < 0.4 ? "stable" : perDay > 0 ? "improving" : "declining";
  return { perDay, perWeek, zPerWeek, dir };
}

/**
 * Baseline as of index `asOf` (defaults to the last day). The centre/spread are
 * computed from history STRICTLY BEFORE today, so "today vs baseline" compares
 * the current reading against the user's established normal rather than itself.
 */
export function baselineFor(
  values: (number | null)[],
  dir: Direction,
  opts: BaselineOptions = {},
  asOf = values.length - 1
): BaselineStat {
  const windowDays = opts.windowDays ?? 60;
  const minObs = opts.minObs ?? 7;
  const halfLife = opts.halfLife ?? 10;

  const current = asOf >= 0 && asOf < values.length ? values[asOf] : null;

  // valid history observations before today, with their day offsets (for trend)
  const from = Math.max(0, asOf - windowDays);
  const hist: { t: number; v: number }[] = [];
  for (let t = from; t < asOf; t++) {
    const v = values[t];
    if (v != null && isFinite(v)) hist.push({ t, v });
  }
  const vals = hist.map((o) => o.v);
  const n = vals.length;
  const spanDays = n ? hist[hist.length - 1].t - hist[0].t + 1 : 0;

  const base: BaselineStat = {
    key: "", dir, available: false, insufficient: true, reason: "need-data",
    current, n, spanDays,
    median: NaN, ewma: NaN, sigma: NaN, p25: NaN, p75: NaN,
    deviation: null, goodnessDeviation: null, z: null, sustainedDays: 0,
    shortTrend: emptySlope(), longTrend: emptySlope(), volatility: NaN, drift: "stable",
    confidence: 0, confidenceLabel: "insufficient",
  };

  if (n < minObs) return base;

  const med = median(vals);
  const rawSigma = robustSigma(vals);
  // Floor sigma so a very consistent user isn't hyper-sensitive to tiny noise,
  // and so we never divide by ~0 for a flat series.
  const sigma = Math.max(isFinite(rawSigma) ? rawSigma : 0, 0.05 * Math.abs(med), 1e-6);
  const p25 = percentile(vals, 0.25);
  const p75 = percentile(vals, 0.75);
  const ew = ewma(vals, halfLife);

  const deviation = current != null ? current - med : null;
  const gsign = goodnessSign(dir);
  const goodnessDeviation = deviation != null ? deviation * (gsign || 1) : null;
  const z = deviation != null ? deviation / sigma : null;

  // sustained "worse than usual": count trailing recent days on the bad side of 1σ
  let sustainedDays = 0;
  if (gsign !== 0) {
    for (let t = asOf; t >= Math.max(0, asOf - 14); t--) {
      const v = values[t];
      if (v == null) { if (t < asOf) continue; else break; } // ignore gaps, but stop only at today
      const zi = (v - med) / sigma;
      const worse = gsign > 0 ? zi <= -1 : zi >= 1;
      if (worse) sustainedDays++; else break;
    }
  }

  const withToday = hist.concat(current != null ? [{ t: asOf, v: current }] : []);
  const shortTrend = slope(withToday, 7);
  const longTrend = slope(withToday, 28);

  const volatility = Math.abs(med) > 0 ? sigma / Math.abs(med) : NaN;

  // Baseline drift: recent-half centre vs older-half centre, in sigmas.
  let drift: Drift = "stable";
  if (n >= Math.max(minObs * 2, 14)) {
    const half = Math.floor(n / 2);
    const older = median(vals.slice(0, half));
    const recent = median(vals.slice(half));
    const d = (recent - older) / sigma;
    drift = d > 0.75 ? "rising" : d < -0.75 ? "falling" : "stable";
  }

  // Confidence: more valid days, better coverage of the window, and lower
  // volatility all raise trust. Saturates — 30+ clean days ≈ full confidence.
  const nScore = clamp(n / 30, 0, 1);
  const coverage = spanDays > 0 ? clamp(n / spanDays, 0, 1) : 0;
  const volScore = isFinite(volatility) ? clamp(1 - volatility / 0.5, 0, 1) : 0.5;
  // Coverage weighted heavily so a device worn only half the time can't reach
  // full confidence on raw day-count alone.
  const confidence = clamp(0.5 * nScore + 0.35 * coverage + 0.15 * volScore, 0, 1);
  const confidenceLabel: Confidence = confidence >= 0.75 ? "high" : confidence >= 0.45 ? "moderate" : "low";

  return {
    ...base,
    available: true,
    insufficient: false,
    reason: undefined,
    median: med, ewma: ew, sigma, p25, p75,
    deviation, goodnessDeviation, z, sustainedDays,
    shortTrend, longTrend, volatility, drift,
    confidence, confidenceLabel,
  };
}

/** How many more clean days until this baseline crosses into "trustworthy". */
export function daysUntilReliable(stat: BaselineStat, target = 14): number {
  return Math.max(0, target - stat.n);
}

export { median, mad };
