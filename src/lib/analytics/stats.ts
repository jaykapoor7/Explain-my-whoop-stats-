/**
 * Robust statistical primitives for the personal-baseline engine.
 *
 * We deliberately favour robust estimators (median, MAD, percentiles, Theil–Sen
 * slope) over mean/stdev so a single abnormal day — a missed workout, a night on
 * a plane, one noisy reading — can't yank a user's "normal" around. Everything
 * here operates on plain number[] of VALID observations only; missing days are
 * filtered out upstream and never enter as zeros.
 */

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function percentile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Median absolute deviation — a robust spread estimator. */
export function mad(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/** MAD scaled to be a consistent estimator of the standard deviation for
 * normal-ish data. This is the "robust sigma" the whole engine reasons in. */
export function robustSigma(xs: number[]): number {
  const s = 1.4826 * mad(xs);
  return isFinite(s) && s > 0 ? s : NaN;
}

/** Exponentially weighted moving average — recency-weighted centre.
 * `halfLifeDays` sets how fast old data fades (10 ≈ last ~2 weeks dominate). */
export function ewma(xs: number[], halfLifeDays = 10): number {
  if (!xs.length) return NaN;
  const alpha = 1 - Math.pow(0.5, 1 / Math.max(1, halfLifeDays));
  let acc = xs[0];
  for (let i = 1; i < xs.length; i++) acc = alpha * xs[i] + (1 - alpha) * acc;
  return acc;
}

/** Theil–Sen slope: the median of pairwise slopes. Robust to outliers, unlike
 * least-squares. `xs` are day-offsets (0,1,2…), `ys` the values. Units: per day. */
export function theilSen(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  const slopes: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dx = xs[j] - xs[i];
      if (dx !== 0) slopes.push((ys[j] - ys[i]) / dx);
    }
  return slopes.length ? median(slopes) : NaN;
}

/** Spearman rank correlation — robust to non-linear-but-monotonic links and to
 * outliers, which Pearson is not. Returns r in [-1,1]. */
export function spearman(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const rank = (arr: number[]): number[] => {
    const idx = arr.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1; // average rank for ties
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs.slice(0, n));
  const ry = rank(ys.slice(0, n));
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? NaN : num / Math.sqrt(dx * dy);
}

export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Smoothly compress an unbounded score into [-1,1] (used to turn robust
 * z-scores into bounded, well-behaved contributions). */
export const squash = (x: number, softness = 2): number => Math.tanh(x / softness);
