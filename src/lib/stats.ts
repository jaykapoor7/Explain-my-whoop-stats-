/** Lightweight statistics used by the insight engine, correlation explorer and experiments. */

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

/** Pearson correlation over paired arrays (must be equal length). */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return NaN;
  return num / Math.sqrt(dx2 * dy2);
}

/** Standard normal CDF (Abramowitz & Stegun approximation). */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

/** Two-sided p-value for a t statistic (normal approximation, adequate for n >= 10). */
export function tToP(t: number, df: number): number {
  if (!isFinite(t) || df <= 0) return 1;
  // Moderate df correction so small samples aren't overconfident.
  const z = Math.abs(t) * (1 - 1 / (4 * df));
  return Math.max(1e-12, 2 * (1 - normCdf(z)));
}

/** p-value for a Pearson r with n samples. */
export function pearsonP(r: number, n: number): number {
  if (!isFinite(r) || n < 4 || Math.abs(r) >= 1) return 1;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  return tToP(t, n - 2);
}

export interface Regression {
  slope: number;
  intercept: number;
  r: number;
  p: number;
  n: number;
}

export function linearRegression(xs: number[], ys: number[]): Regression {
  const n = Math.min(xs.length, ys.length);
  const r = pearson(xs, ys);
  const sx = std(xs.slice(0, n));
  const sy = std(ys.slice(0, n));
  const slope = (r * sy) / sx;
  const intercept = mean(ys.slice(0, n)) - slope * mean(xs.slice(0, n));
  return { slope, intercept, r, p: pearsonP(r, n), n };
}

export interface GroupComparison {
  meanA: number;
  meanB: number;
  nA: number;
  nB: number;
  diff: number;
  /** Cohen's d effect size */
  d: number;
  p: number;
}

/** Welch's t-test comparing two independent samples. */
export function compareGroups(a: number[], b: number[]): GroupComparison | null {
  if (a.length < 4 || b.length < 4) return null;
  const ma = mean(a);
  const mb = mean(b);
  const va = std(a) ** 2;
  const vb = std(b) ** 2;
  const se = Math.sqrt(va / a.length + vb / b.length);
  if (se === 0) return null;
  const t = (ma - mb) / se;
  const dfNum = (va / a.length + vb / b.length) ** 2;
  const dfDen =
    (va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1);
  const df = dfNum / Math.max(1e-9, dfDen);
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
  return {
    meanA: ma,
    meanB: mb,
    nA: a.length,
    nB: b.length,
    diff: ma - mb,
    d: pooled === 0 ? 0 : (ma - mb) / pooled,
    p: tToP(t, df),
  };
}

/** Simple centered rolling mean; window must be odd-ish, edges shrink. */
export function rollingMean(values: (number | undefined)[], window: number): (number | null)[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - half), Math.min(values.length, i + half + 1))
      .filter((v): v is number => v !== undefined && v !== null && isFinite(v));
    return slice.length >= Math.max(2, Math.floor(window / 2)) ? mean(slice) : null;
  });
}

/** Map a p-value + sample size onto a human confidence tier. */
export function confidenceTier(p: number, n: number): {
  tier: "high" | "moderate" | "exploratory";
  score: number;
} {
  const sizeFactor = Math.min(1, n / 45);
  const pFactor = p < 0.01 ? 1 : p < 0.05 ? 0.75 : p < 0.1 ? 0.5 : 0.25;
  const score = Math.round(100 * (0.65 * pFactor + 0.35 * sizeFactor)) / 100;
  if (p < 0.01 && n >= 30) return { tier: "high", score };
  if (p < 0.05 && n >= 14) return { tier: "moderate", score };
  return { tier: "exploratory", score: Math.min(score, 0.5) };
}

export function fmt(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || !isFinite(value)) return "–";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
