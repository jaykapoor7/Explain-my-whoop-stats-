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
  const charging: Contributor[] = [];
  if (sleepOk) charging.push(term("Sleep", (sleep.score - 60) * 0.32, `Sleep scored ${Math.round(sleep.score)} overnight`));
  if (hasHrv(day)) charging.push(term("HRV", (day.hrv.rmssdMs - baseline.hrvMs) * 0.7, `${day.hrv.rmssdMs} ms vs ${Math.round(baseline.hrvMs)} ms typical`));
  if (recoveryOk) charging.push(term("Recovery base", (recovery.score - 55) * 0.22, `Woke at ${Math.round(recovery.score)}% recovery`));
  const rhrDelta = day.rhr.bpm - baseline.rhrBpm;
  if (day.rhr.bpm > 0 && Math.abs(rhrDelta) >= 1.5) {
    charging.push(term(rhrDelta > 0 ? "Elevated RHR" : "Low RHR", -rhrDelta * 1.5, `${day.rhr.bpm} bpm this morning`));
  }
  const spend = countedActivities(day).map((a) =>
    term(a.type, -a.load * 0.85, `${a.durationMin}m at avg ${a.avgHr} bpm`)
  );
  const terms = [...charging, ...spend];
  const score = clamp(56 + terms.reduce((a, c) => a + c.points, 0), 3, 99);
  const status = score >= 70 ? "Charged" : score >= 45 ? "Steady" : score >= 25 ? "Draining" : "Depleted";
  const spent = Math.round(Math.abs(spend.reduce((a, c) => a + c.points, 0)));
  const start = sleepOk ? (sleep.score >= 70 ? "well-charged" : "partially charged") : recoveryOk && recovery.score >= 60 ? "well-charged" : "partially charged";
  return build(
    "energy",
    100,
    score,
    terms,
    status,
    `You started with a ${start} battery and today's activity has drawn roughly ${spent} points so far.`
  );
}
