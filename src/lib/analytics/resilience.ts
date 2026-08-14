import type { DailySummary } from "../types";
import { MetricKey, series, metricDef, goodnessSign } from "./metrics";
import { median, robustSigma } from "./stats";

/**
 * Resilience model. Resilience = how quickly and consistently your body returns
 * toward its personal baseline after a knock (bad night, big load, stress,
 * illness). It's inherently longitudinal — measured across episodes over weeks,
 * never from a single day. We read it from the autonomic markers (HRV, RHR),
 * which move first and recover visibly.
 */

export interface Episode {
  metric: MetricKey;
  startIndex: number;   // day index where the disruption bottomed out
  magnitude: number;    // peak deviation in personal sigmas
  recoveryDays: number | null; // days back to within 0.5σ of baseline (null = still out / censored)
}

export interface ResilienceReport {
  available: boolean;
  reason?: string;
  episodes: Episode[];
  avgRecoveryDays: number | null;
  disruptionsPerMonth: number | null;
  /** improving = returning to baseline faster than you used to */
  direction: "improving" | "declining" | "stable" | "insufficient";
  deltaDays: number | null; // recent avg recovery minus earlier avg (negative = faster)
  score: number | null;     // 0..100 personalised resilience index
  confidence: number;
}

const DISRUPT = 1.2; // sigmas into the "worse" side to count as a disruption
const RETURN = 0.5;  // back inside ±0.5σ counts as recovered

function episodesFor(days: DailySummary[], key: MetricKey): Episode[] {
  const vals = series(days, key);
  const g = goodnessSign(metricDef(key).dir) || 1;
  const eps: Episode[] = [];
  let i = 0;
  while (i < vals.length) {
    // rolling baseline from the prior 30 valid observations
    const histVals: number[] = [];
    for (let t = Math.max(0, i - 30); t < i; t++) if (vals[t] != null) histVals.push(vals[t] as number);
    if (histVals.length < 10 || vals[i] == null) { i++; continue; }
    const med = median(histVals);
    const sig = Math.max(robustSigma(histVals) || 0, 0.05 * Math.abs(med), 1e-6);
    const z = ((vals[i] as number) - med) * g / sig; // + = better, - = worse

    if (z <= -DISRUPT) {
      // find trough + recovery within a 14-day horizon
      let trough = i, troughZ = z, j = i;
      let recoveryDays: number | null = null;
      for (; j < Math.min(vals.length, i + 15); j++) {
        if (vals[j] == null) continue;
        const zj = ((vals[j] as number) - med) * g / sig;
        if (zj < troughZ) { troughZ = zj; trough = j; }
        if (zj >= -RETURN && j > i) { recoveryDays = j - trough; break; }
      }
      eps.push({ metric: key, startIndex: trough, magnitude: -troughZ, recoveryDays });
      i = Math.max(j, i + 1);
    } else i++;
  }
  return eps;
}

export function computeResilience(days: DailySummary[]): ResilienceReport {
  const eps = [...episodesFor(days, "hrv"), ...episodesFor(days, "rhr")].sort((a, b) => a.startIndex - b.startIndex);
  const recovered = eps.filter((e) => e.recoveryDays != null) as (Episode & { recoveryDays: number })[];

  if (recovered.length < 2) {
    return { available: false, reason: "need-episodes", episodes: eps, avgRecoveryDays: null, disruptionsPerMonth: null, direction: "insufficient", deltaDays: null, score: null, confidence: recovered.length ? 0.2 : 0 };
  }

  const avg = median(recovered.map((e) => e.recoveryDays));
  const spanDays = (days.length || 1);
  const disruptionsPerMonth = (eps.length / spanDays) * 30;

  // recent vs earlier recovery speed → direction
  const half = Math.floor(recovered.length / 2);
  const earlier = median(recovered.slice(0, half).map((e) => e.recoveryDays));
  const recent = median(recovered.slice(half).map((e) => e.recoveryDays));
  const deltaDays = recovered.length >= 4 && isFinite(earlier) && isFinite(recent) ? recent - earlier : null;
  const direction = deltaDays == null ? "stable" : deltaDays < -0.5 ? "improving" : deltaDays > 0.5 ? "declining" : "stable";

  // score: faster recovery + fewer disruptions = higher. Anchored so ~1.5 day
  // recovery and ~2 disruptions/month land mid-70s.
  const speedScore = Math.max(0, 100 - avg * 22);
  const freqScore = Math.max(0, 100 - disruptionsPerMonth * 10);
  const score = Math.round(Math.max(0, Math.min(100, 0.65 * speedScore + 0.35 * freqScore)));
  const confidence = Math.min(1, recovered.length / 8);

  return { available: true, episodes: eps, avgRecoveryDays: avg, disruptionsPerMonth, direction, deltaDays, score, confidence };
}
