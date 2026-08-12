import { Contributor, DailySummary, PersonalBaseline, RecoveryScore, ScoreResult } from "../types";
import { clamp } from "../format";
import { build, hasHrv, hasRhr, term, unavailable } from "./sleep";

/**
 * RecoveryCalculator — deterministic mock, 0..100.
 * "How prepared is my body for additional stress?"
 * Inputs: HRV vs baseline, RHR vs baseline, last night's sleep score,
 * sleep consistency, and yesterday's strain.
 *
 * NOTE: placeholder weights. The finished algorithm will be designed separately.
 */
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
  const hrvDelta = day.hrv.rmssdMs - baseline.hrvMs;
  const rhrDelta = day.rhr.bpm - baseline.rhrBpm;
  const terms: Contributor[] = [];
  if (hasHrv(day)) terms.push(term("HRV vs baseline", hrvDelta * 1.1, `${day.hrv.rmssdMs} ms vs ${Math.round(baseline.hrvMs)} ms typical`));
  if (hasRhr(day)) terms.push(term("Resting HR", -rhrDelta * 2.2, `${day.rhr.bpm} bpm vs ${Math.round(baseline.rhrBpm)} bpm typical`));
  if (sleepOk) {
    terms.push(term("Sleep", (sleep.score - 65) * 0.45, `Last night scored ${Math.round(sleep.score)}`));
    terms.push(term("Sleep consistency", (day.sleep.consistencyPct - 78) * 0.12, `${day.sleep.consistencyPct}% regular timing`));
  }
  terms.push(term("Yesterday's strain", -(prevStrain - 10) * 1.4, `${prevStrain.toFixed(1)} load yesterday`));
  const score = clamp(58 + terms.reduce((a, c) => a + c.points, 0), 3, 99);
  const status = score >= 67 ? "Primed" : score >= 34 ? "Adequate" : "Compromised";
  const top = [...terms].sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0];
  return build(
    "recovery",
    100,
    score,
    terms,
    status,
    status === "Primed"
      ? `Your body absorbed yesterday's load — biggest driver: ${top.label.toLowerCase()}.`
      : status === "Adequate"
        ? `Partial recovery. The main thing holding you back is ${[...terms].filter((t) => t.points < 0).sort((a, b) => a.points - b.points)[0]?.label.toLowerCase() ?? "accumulated load"}.`
        : `Your body is still repairing. Ease off — ${[...terms].filter((t) => t.points < 0).sort((a, b) => a.points - b.points)[0]?.label.toLowerCase() ?? "load"} hit hardest.`
  );
}
