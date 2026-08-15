import { Contributor, DailySummary, PersonalBaseline, RecoveryScore, ScoreResult } from "../types";
import { clamp } from "../format";
import { build, hasHrv, hasRhr, lc, term, unavailable } from "./sleep";

/**
 * RecoveryCalculator — deterministic mock, 0..100.
 * "How prepared is my body for additional stress?"
 * Inputs: HRV vs baseline, RHR vs baseline, last night's sleep score,
 * sleep consistency, and yesterday's strain.
 *
 * NOTE: placeholder weights. The finished algorithm will be designed separately.
 */

/** Neutral midpoint: an average day with nothing pulling recovery up or down
 * lands here. Every factor is a signed move off this base. */
export const RECOVERY_BASE = 58;

export function calcRecovery(
  day: DailySummary,
  baseline: PersonalBaseline,
  sleep: ScoreResult,
  prevStrain: number
): RecoveryScore {
  const sleepOk = sleep.available !== false;
  // Like WHOOP, recovery isn't shown until last night's sleep has been
  // processed — it's the anchor of the score, so no sleep means no recovery yet.
  if (!sleepOk) {
    return unavailable("recovery", 100, "Awaiting sleep", "Recovery is calculated once last night's sleep has been recorded and processed.");
  }
  const clampV = (v: number, lo: number, hi: number) => clamp(v, lo, hi);
  // HRV is the primary autonomic signal — measured as % deviation from your
  // own baseline so it reads the same whether your typical HRV is 40 or 90 ms.
  const hrvPct = baseline.hrvMs > 0 ? (day.hrv.rmssdMs - baseline.hrvMs) / baseline.hrvMs : 0;
  const rhrDelta = day.rhr.bpm - baseline.rhrBpm;

  const terms: Contributor[] = [];
  if (hasHrv(day)) {
    const pts = Math.round(clampV(hrvPct * 55, -26, 24));
    terms.push(term("HRV", pts,
      `${day.hrv.rmssdMs} ms vs ${Math.round(baseline.hrvMs)} ms typical (${signedPct(hrvPct)})`,
      { math: `Your overnight HRV of ${day.hrv.rmssdMs} ms is ${signedPct(hrvPct)} vs your ${Math.round(baseline.hrvMs)} ms baseline. Scaled ×55 (HRV is the primary autonomic signal) → ${pts >= 0 ? "+" : ""}${pts}.` }));
  }
  if (hasRhr(day)) {
    const pts = Math.round(clampV(-rhrDelta * 2.3, -22, 16));
    terms.push(term("Resting HR", pts,
      `${day.rhr.bpm} bpm vs ${Math.round(baseline.rhrBpm)} bpm typical`,
      { math: `Resting HR ${day.rhr.bpm} bpm is ${Math.abs(rhrDelta).toFixed(0)} bpm ${rhrDelta > 0 ? "above" : "below"} your ${Math.round(baseline.rhrBpm)} bpm baseline. A lower RHR means more recovered → ${pts >= 0 ? "+" : ""}${pts}.` }));
  }
  const sleepPts = Math.round(clampV((sleep.score - 60) * 0.4, -15, 15));
  terms.push(term("Sleep quality", sleepPts,
    `Last night scored ${Math.round(sleep.score)}/100`,
    { math: `Last night's sleep scored ${Math.round(sleep.score)}/100. Measured vs a neutral 60 and scaled ×0.4 → ${sleepPts >= 0 ? "+" : ""}${sleepPts}.` }));
  const debtPts = Math.round(clampV(-day.sleep.debtMin / 45, -4, 2));
  terms.push(term("Sleep debt", debtPts,
    day.sleep.debtMin > 0 ? `${fmtShort(day.sleep.debtMin)} accrued shortfall` : "well rested",
    { math: `You're carrying ${fmtShort(day.sleep.debtMin)} of rolling sleep debt → ${debtPts >= 0 ? "+" : ""}${debtPts}. Kept small so it doesn't double-count with sleep quality.` }));
  // Acute vs chronic training load: yesterday's strain measured against your
  // rolling-two-week typical, not a fixed number — spiking above your norm costs
  // recovery, backing off returns some.
  const loadGap = prevStrain - baseline.strain;
  const loadPts = Math.round(clampV(-loadGap * 1.5, -20, 10));
  terms.push(term("Training load", loadPts,
    `${prevStrain.toFixed(1)} yesterday vs ${baseline.strain.toFixed(1)} typical`,
    { math: `Yesterday's strain of ${prevStrain.toFixed(1)} vs your ${baseline.strain.toFixed(1)} two-week typical is a gap of ${loadGap >= 0 ? "+" : ""}${loadGap.toFixed(1)}. ${loadGap > 0 ? "Training above your norm costs recovery" : "Backing off returns some"} → ${loadPts >= 0 ? "+" : ""}${loadPts}.` }));

  const score = clamp(RECOVERY_BASE + terms.reduce((a, c) => a + c.points, 0), 3, 99);
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
const signedPct = (frac: number) => `${frac >= 0 ? "+" : ""}${Math.round(frac * 100)}%`;
