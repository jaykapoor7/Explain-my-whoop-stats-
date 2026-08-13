import { Contributor, DailySummary, EnergyScore, PersonalBaseline, ScoreResult } from "../types";
import { clamp } from "../format";
import { build, hasHrv, term, unavailable } from "./sleep";
import { countedActivities } from "./strain";

/**
 * EnergyCalculator — deterministic mock, 0..100.
 * Energy = available physiological capacity right now: what sleep and
 * recovery put in the tank, minus what today's activity has already spent.
 * This is the "Sleep +9 / HRV +4 / Walk +2 / Football −6" ledger.
 *
 * NOTE: placeholder weights. The finished algorithm will be designed separately.
 */
export function calcEnergy(
  day: DailySummary,
  baseline: PersonalBaseline,
  sleep: ScoreResult,
  recovery: ScoreResult
): EnergyScore {
  const sleepOk = sleep.available !== false;
  const recoveryOk = recovery.available !== false;
  // With no overnight signal at all there's nothing to gauge starting capacity from.
  if (!sleepOk && !recoveryOk && !hasHrv(day)) {
    return unavailable("energy", 100, "No data", "No sleep, recovery or HRV data synced for this day yet.");
  }
  const cl = (v: number, lo: number, hi: number) => clamp(v, lo, hi);
  // --- What charged the battery overnight ---
  const charging: Contributor[] = [];
  if (sleepOk) charging.push(term("Sleep", cl((sleep.score - 60) * 0.34, -20, 18), `Last night scored ${Math.round(sleep.score)}/100`));
  if (recoveryOk) charging.push(term("Recovery base", cl((recovery.score - 55) * 0.26, -16, 14), `Woke at ${Math.round(recovery.score)}% recovery`));
  if (hasHrv(day)) {
    const hrvPct = baseline.hrvMs > 0 ? (day.hrv.rmssdMs - baseline.hrvMs) / baseline.hrvMs : 0;
    charging.push(term("HRV", cl(hrvPct * 30, -14, 12), `${day.hrv.rmssdMs} ms vs ${Math.round(baseline.hrvMs)} ms typical`));
  }
  const rhrDelta = day.rhr.bpm - baseline.rhrBpm;
  if (day.rhr.bpm > 0 && Math.abs(rhrDelta) >= 1.5) {
    charging.push(term(rhrDelta > 0 ? "Elevated resting HR" : "Low resting HR", cl(-rhrDelta * 1.5, -12, 10), `${day.rhr.bpm} bpm this morning`));
  }
  if (sleepOk && day.sleep.debtMin > 45) {
    charging.push(term("Sleep debt", cl(-day.sleep.debtMin / 30, -8, 0), `${fmtShort(day.sleep.debtMin)} shortfall carried in`));
  }

  // --- What today's activity has already spent ---
  const spend = countedActivities(day).map((a) =>
    term(a.type, cl(-a.load * 0.85, -20, 0), `${a.durationMin}m${a.avgHr > 0 ? ` at avg ${a.avgHr} bpm` : ""}`)
  );

  const terms = [...charging, ...spend];
  const score = clamp(56 + terms.reduce((a, c) => a + c.points, 0), 3, 99);
  const status = score >= 70 ? "Charged" : score >= 45 ? "Steady" : score >= 25 ? "Draining" : "Depleted";
  const spent = Math.round(Math.abs(spend.reduce((a, c) => a + c.points, 0)));
  const chargedInto = Math.round(charging.reduce((a, c) => a + Math.max(0, c.points), 0));
  const start = sleepOk ? (sleep.score >= 70 ? "well-charged" : "partially charged") : recoveryOk && recovery.score >= 60 ? "well-charged" : "partially charged";
  const spendLine = spend.length ? `today's activity has drawn roughly ${spent} points back out` : `you haven't spent much on activity yet`;
  return build(
    "energy",
    100,
    score,
    terms,
    status,
    `Sleep and recovery put about ${chargedInto} points into the tank overnight (${start}); ${spendLine}.`
  );
}

function fmtShort(min: number): string {
  return min >= 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${Math.round(min)}m`;
}
