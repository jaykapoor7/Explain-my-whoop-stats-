import { DailySummary, EnergyScore, PersonalBaseline } from "../types";
import { clamp } from "../format";
import { build, term } from "./sleep";
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
  sleepScore: number,
  recoveryScore: number
): EnergyScore {
  const charging = [
    term("Sleep", (sleepScore - 60) * 0.32, `Sleep scored ${Math.round(sleepScore)} overnight`),
    term("HRV", (day.hrv.rmssdMs - baseline.hrvMs) * 0.7, `${day.hrv.rmssdMs} ms vs ${Math.round(baseline.hrvMs)} ms typical`),
    term("Recovery base", (recoveryScore - 55) * 0.22, `Woke at ${Math.round(recoveryScore)}% recovery`),
  ];
  const rhrDelta = day.rhr.bpm - baseline.rhrBpm;
  if (Math.abs(rhrDelta) >= 1.5) {
    charging.push(term(rhrDelta > 0 ? "Elevated RHR" : "Low RHR", -rhrDelta * 1.5, `${day.rhr.bpm} bpm this morning`));
  }
  const spend = countedActivities(day).map((a) =>
    term(a.type, -a.load * 0.85, `${a.durationMin}m at avg ${a.avgHr} bpm`)
  );
  const terms = [...charging, ...spend];
  const score = clamp(56 + terms.reduce((a, c) => a + c.points, 0), 3, 99);
  const status = score >= 70 ? "Charged" : score >= 45 ? "Steady" : score >= 25 ? "Draining" : "Depleted";
  const spent = Math.round(Math.abs(spend.reduce((a, c) => a + c.points, 0)));
  return build(
    "energy",
    100,
    score,
    terms,
    status,
    `You started with a ${sleepScore >= 70 ? "well-charged" : "partially charged"} battery and today's activity has drawn roughly ${spent} points so far.`
  );
}
