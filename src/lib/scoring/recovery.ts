import { Contributor, DailySummary, PersonalBaseline, RecoveryScore, ScoreResult } from "../types";
import { clamp } from "../format";
import { build, hasHrv, hasRhr, lc, term, unavailable } from "./sleep";

/**
 * RecoveryCalculator — 0..100, HRV-guided readiness.
 *
 * Method follows the sports-science standard used by Kubios / HRV4Training /
 * Elite HRV: the natural log of rMSSD (lnRMSSD — rMSSD is log-normal, so you log
 * it) expressed as a z-score against YOUR OWN rolling baseline, combined with a
 * lower-is-better resting-HR z-score, last night's sleep and yesterday's load.
 *
 * The score is centred so that sitting exactly AT your personal baseline maps to
 * 50 — the true middle. That is deliberate: it makes systematic inflation or
 * deflation impossible, because "average for you" is 50 by construction. Being
 * above your baseline moves you up, below moves you down, in units of your own
 * variability. (Zones follow the common convention: ≥67 green, 34–66 yellow,
 * <34 red.)
 */

/** The reference is "you at your own baseline" → 50 (the true midpoint), not a
 * hand-tuned constant. */
export const RECOVERY_BASE = 50;

// Weights: HRV dominant (the primary autonomic recovery signal), then RHR, then
// sleep, then load. Sum to 1 so the composite is a proper weighted z-score.
const W = { hrv: 0.5, rhr: 0.25, sleep: 0.15, load: 0.1 };
const SCALE = 22; // z-composite → points; ~+1σ overall ≈ +22, so a great day ≈ 90s, a poor one ≈ 20s

export function calcRecovery(
  day: DailySummary,
  baseline: PersonalBaseline,
  sleep: ScoreResult,
  prevStrain: number
): RecoveryScore {
  const sleepOk = sleep.available !== false;
  if (!sleepOk) {
    return unavailable("recovery", 100, "Awaiting sleep", "Recovery is calculated once last night's sleep has been recorded and processed.");
  }
  const clampV = (v: number, lo: number, hi: number) => clamp(v, lo, hi);
  const hrvSigma = baseline.hrvSigma && baseline.hrvSigma > 0 ? baseline.hrvSigma : Math.max(baseline.hrvMs * 0.1, 4);
  const rhrSigma = baseline.rhrSigma && baseline.rhrSigma > 0 ? baseline.rhrSigma : Math.max(baseline.rhrBpm * 0.05, 2);
  const sig1 = (z: number) => `${z >= 0 ? "+" : ""}${z.toFixed(1)}σ`;

  // lnRMSSD z-score: log the value (rMSSD is log-normal) and standardise by your
  // own coefficient of variation — the HRV4Training / Kubios readiness marker.
  const cv = baseline.hrvMs > 0 ? hrvSigma / baseline.hrvMs : 0.1;
  const zHrv = day.hrv.rmssdMs > 0 && baseline.hrvMs > 0
    ? clampV(Math.log(day.hrv.rmssdMs / baseline.hrvMs) / (cv || 0.1), -3, 3) : 0;
  const zRhr = clampV((baseline.rhrBpm - day.rhr.bpm) / rhrSigma, -3, 3); // + = lower RHR (better)
  const zSleep = clampV((sleep.score - (baseline.sleep && baseline.sleep > 0 ? baseline.sleep : 72)) / 12, -3, 3);
  const zLoad = clampV((baseline.strain - prevStrain) / Math.max(baseline.strain * 0.6, 3), -2, 2); // + = eased off vs your norm
  const rhrDelta = day.rhr.bpm - baseline.rhrBpm;

  const terms: Contributor[] = [];
  if (hasHrv(day)) {
    const pts = Math.round(SCALE * W.hrv * zHrv);
    terms.push(term("HRV", pts,
      `${day.hrv.rmssdMs} ms — ${sig1(zHrv)} vs your normal`,
      { math: `lnRMSSD readiness (the HRV4Training/Kubios standard): log of your ${day.hrv.rmssdMs} ms vs your ${Math.round(baseline.hrvMs)} ms baseline, standardised by your own ${Math.round(cv * 100)}% variability → ${sig1(zHrv)}, weighted 50% → ${pts >= 0 ? "+" : ""}${pts}.` }));
  }
  if (hasRhr(day)) {
    const pts = Math.round(SCALE * W.rhr * zRhr);
    terms.push(term("Resting HR", pts,
      `${day.rhr.bpm} bpm — ${sig1(zRhr)} vs your normal`,
      { math: `Resting HR ${day.rhr.bpm} bpm is ${Math.abs(rhrDelta).toFixed(0)} bpm ${rhrDelta > 0 ? "above" : "below"} your ${Math.round(baseline.rhrBpm)} bpm baseline (${sig1(zRhr)}), weighted 25% → ${pts >= 0 ? "+" : ""}${pts}.` }));
  }
  const sleepPts = Math.round(SCALE * W.sleep * zSleep);
  terms.push(term("Sleep quality", sleepPts,
    `Last night ${Math.round(sleep.score)} vs your ${Math.round(baseline.sleep && baseline.sleep > 0 ? baseline.sleep : 72)} typical`,
    { math: `Last night's sleep ${Math.round(sleep.score)} vs your typical (${sig1(zSleep)}), weighted 15% → ${sleepPts >= 0 ? "+" : ""}${sleepPts}.` }));
  const loadPts = Math.round(SCALE * W.load * zLoad);
  terms.push(term("Training load", loadPts,
    `${prevStrain.toFixed(1)} yesterday vs ${baseline.strain.toFixed(1)} typical`,
    { math: `Yesterday's strain ${prevStrain.toFixed(1)} vs your ${baseline.strain.toFixed(1)} typical (${sig1(zLoad)}), weighted 10% → ${loadPts >= 0 ? "+" : ""}${loadPts}.` }));
  // Sleep debt is a direct deficit, not a z-score — a real, published readiness
  // drag. Meaningful weight so a big shortfall clearly lowers recovery.
  const debtPts = -Math.round(clampV((day.sleep.debtMin / 60) * 3, 0, 12));
  if (debtPts !== 0) {
    terms.push(term("Sleep debt", debtPts,
      `${fmtShort(day.sleep.debtMin)} accrued shortfall`,
      { math: `You're carrying ${fmtShort(day.sleep.debtMin)} of rolling sleep debt — a direct readiness cost of about 3 points per hour → ${debtPts}.` }));
  }

  const score = clamp(Math.round(RECOVERY_BASE + terms.reduce((a, c) => a + c.points, 0)), 1, 99);
  const status = score >= 67 ? "Primed" : score >= 34 ? "Adequate" : "Compromised";
  const ranked = [...terms].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const topHurt = [...terms].filter((t) => t.points < 0).sort((a, b) => a.points - b.points)[0];
  const topHelp = ranked.find((t) => t.points > 0);
  return build(
    "recovery",
    100,
    score,
    terms,
    status,
    status === "Primed"
      ? `Your body absorbed yesterday's load and is ready for more${topHelp ? ` — led by ${lc(topHelp.label)}` : ""}.`
      : status === "Adequate"
        ? `Partial recovery — you can train, but keep it moderate. Biggest drag: ${lc(topHurt?.label ?? "accumulated load")}.`
        : `Your body is still repairing. Prioritise rest today — ${lc(topHurt?.label ?? "load")} hit hardest.`
  );
}

const fmtShort = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${Math.round(min)}m`);
