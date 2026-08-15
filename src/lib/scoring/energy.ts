import { Contributor, DailySummary, EnergyScore, PersonalBaseline, ScoreResult } from "../types";
import { clamp } from "../format";
import { build, hasHrv, term, unavailable } from "./sleep";
import { countedActivities } from "./strain";

/**
 * EnergyCalculator — deterministic, 0..100.
 *
 * Energy is modelled in two phases, the way a battery actually works:
 *
 *   1. MORNING CAPACITY — how much you woke up with. Built from an anchor plus
 *      how well you slept, this morning's recovery, your HRV/RHR vs your own
 *      baseline, AND how hard you went YESTERDAY (a big day leaves residual
 *      fatigue, so you start lower; an easy/rest day tops you up). This is the
 *      "how much can I expend today" number.
 *   2. SPEND — today's counted activity draws the tank down from there.
 *
 * Energy now = morning capacity − spend. Every term is signed and grouped so
 * the UI can show "you woke with X, you've spent Y, you have Z left".
 */

/** Physiological anchor for morning capacity — an average night with average
 * recovery and a normal day behind you lands near here. Set on the generous side
 * so a typical day reads as usable energy rather than a harsh middling score.
 * Readiness and yesterday's load move you off it; NOT shown as a flat "neutral". */
export const ENERGY_ANCHOR = 64;

export interface EnergySplit {
  morningCapacity: number; // start-of-day score (0..100)
  spent: number;           // points drawn down by today's activity (>= 0)
}

/** Recompute the capacity/spend split from a finished energy score's contributors,
 * so the UI never re-derives the math and can't drift from the scorer. */
export function energySplit(e: ScoreResult): EnergySplit {
  if (e.available === false) return { morningCapacity: 0, spent: 0 };
  const capTerms = e.contributors.filter((c) => c.group !== "spend");
  const spend = e.contributors.filter((c) => c.group === "spend");
  const morningCapacity = clamp(ENERGY_ANCHOR + capTerms.reduce((a, c) => a + c.points, 0), 3, 99);
  const spent = Math.round(Math.abs(spend.reduce((a, c) => a + c.points, 0)));
  return { morningCapacity: Math.round(morningCapacity), spent };
}

export function calcEnergy(
  day: DailySummary,
  baseline: PersonalBaseline,
  sleep: ScoreResult,
  recovery: ScoreResult,
  prevStrain: number
): EnergyScore {
  const sleepOk = sleep.available !== false;
  const recoveryOk = recovery.available !== false;
  // With no overnight signal at all there's nothing to gauge starting capacity from.
  if (!sleepOk && !recoveryOk && !hasHrv(day)) {
    return unavailable("energy", 100, "No data", "No sleep, recovery or HRV data synced for this day yet.");
  }
  const cl = (v: number, lo: number, hi: number) => clamp(v, lo, hi);

  // ---------- Phase 1: morning capacity (what you woke up with) ----------
  const capacity: Contributor[] = [];
  if (sleepOk) {
    const pts = Math.round(cl((sleep.score - 60) * 0.3, -16, 16));
    capacity.push(term("Sleep", pts, `Last night scored ${Math.round(sleep.score)}/100`, {
      group: "capacity",
      math: `Sleep ${Math.round(sleep.score)} vs a neutral 60, scaled ×0.3 → ${pts >= 0 ? "+" : ""}${pts}. Good nights charge the tank; poor ones start you lower.`,
    }));
  }
  if (recoveryOk) {
    const pts = Math.round(cl((recovery.score - 55) * 0.24, -14, 14));
    capacity.push(term("Recovery", pts, `Woke at ${Math.round(recovery.score)}% recovery`, {
      group: "capacity",
      math: `Recovery ${Math.round(recovery.score)}% vs a neutral 55, scaled ×0.24 → ${pts >= 0 ? "+" : ""}${pts}. Your autonomic readiness this morning.`,
    }));
  }
  // Judge HRV / RHR in units of YOUR OWN day-to-day spread (robust σ), not a
  // fixed slope — the same deviation means more for a steady person than a
  // naturally-variable one.
  const hrvSigma = baseline.hrvSigma && baseline.hrvSigma > 0 ? baseline.hrvSigma : Math.max(baseline.hrvMs * 0.1, 4);
  const rhrSigma = baseline.rhrSigma && baseline.rhrSigma > 0 ? baseline.rhrSigma : Math.max(baseline.rhrBpm * 0.05, 2);
  const sig1 = (z: number) => `${z >= 0 ? "+" : ""}${z.toFixed(1)}σ`;
  if (hasHrv(day)) {
    const zHrv = (day.hrv.rmssdMs - baseline.hrvMs) / hrvSigma;
    const pts = Math.round(cl(zHrv * 7, -14, 12));
    capacity.push(term("HRV", pts, `${day.hrv.rmssdMs} ms — ${sig1(zHrv)} vs your normal`, {
      group: "capacity",
      math: `HRV ${day.hrv.rmssdMs} ms is ${sig1(zHrv)} from your ${Math.round(baseline.hrvMs)} ms baseline, against your own ±${Math.round(hrvSigma)} ms spread → ${pts >= 0 ? "+" : ""}${pts}.`,
    }));
  }
  const rhrDelta = day.rhr.bpm - baseline.rhrBpm;
  if (day.rhr.bpm > 0 && Math.abs(rhrDelta) >= 1.0) {
    const zRhr = (baseline.rhrBpm - day.rhr.bpm) / rhrSigma; // + = lower RHR (better)
    const pts = Math.round(cl(zRhr * 5, -12, 10));
    capacity.push(term(rhrDelta > 0 ? "Elevated resting HR" : "Low resting HR", pts, `${day.rhr.bpm} bpm — ${sig1(zRhr)} vs your normal`, {
      group: "capacity",
      math: `Resting HR ${day.rhr.bpm} bpm is ${sig1(zRhr)} against your own ±${Math.round(rhrSigma)} bpm spread → ${pts >= 0 ? "+" : ""}${pts}. A raised RHR flags your body is still working.`,
    }));
  }
  // NEW — yesterday's load carries over. Train hard and you wake with less in the
  // tank; take it easy (or rest) and you top up a little. Measured against YOUR
  // typical daily strain so a normal day is neutral.
  if (isFinite(prevStrain)) {
    const strainGap = prevStrain - (isFinite(baseline.strain) ? baseline.strain : 10);
    const pts = Math.round(cl(-strainGap * 1.1, -12, 5));
    if (Math.abs(pts) >= 1) {
      capacity.push(term("Yesterday's load", pts, `Yesterday's strain ${prevStrain.toFixed(1)} vs ${(baseline.strain || 10).toFixed(1)} typical`, {
        group: "capacity",
        math: `Yesterday you hit ${prevStrain.toFixed(1)} strain vs your ${(baseline.strain || 10).toFixed(1)} typical. ${strainGap > 0 ? "A harder-than-usual day leaves residual fatigue" : "An easier day let you top up"} → ${pts >= 0 ? "+" : ""}${pts}.`,
      }));
    }
  }
  // Large accrued sleep debt takes a little extra off the top (kept light — sleep
  // and recovery already reflect most of it).
  if (sleepOk && day.sleep.debtMin > 120) {
    const pts = Math.round(cl(-(day.sleep.debtMin - 120) / 45, -4, 0));
    capacity.push(term("Sleep debt", pts, `${fmtShort(day.sleep.debtMin)} shortfall carried in`, {
      group: "capacity",
      math: `You're carrying ${fmtShort(day.sleep.debtMin)} of rolling sleep debt; the part beyond 2h trims capacity → ${pts}.`,
    }));
  }

  const morningCapacity = clamp(ENERGY_ANCHOR + capacity.reduce((a, c) => a + c.points, 0), 3, 99);

  // ---------- Phase 2: spend (today's activity draws it down) ----------
  const spend = countedActivities(day).map((a) => {
    const pts = Math.round(cl(-a.load * 0.85, -20, 0));
    return term(a.type, pts, `${a.durationMin}m${a.avgHr > 0 ? ` at avg ${a.avgHr} bpm` : ""}`, {
      group: "spend",
      math: `${a.type} carried ${a.load.toFixed(1)} strain; energy spent ≈ load ×0.85 → ${pts}.`,
    });
  });

  const terms = [...capacity, ...spend];
  const score = clamp(morningCapacity + spend.reduce((a, c) => a + c.points, 0), 3, 99);
  const status = score >= 70 ? "Charged" : score >= 45 ? "Steady" : score >= 25 ? "Draining" : "Depleted";
  const spent = Math.round(Math.abs(spend.reduce((a, c) => a + c.points, 0)));
  const capWord = morningCapacity >= 70 ? "well-charged" : morningCapacity >= 50 ? "moderately charged" : "under-charged";
  const spendLine = spend.length ? `today's activity has spent about ${spent}` : `you've spent little on activity so far`;
  return build(
    "energy",
    100,
    score,
    terms,
    status,
    `You woke ${capWord} with a capacity of ${Math.round(morningCapacity)} — set by last night's sleep, this morning's recovery and how hard you went yesterday. From there, ${spendLine}.`
  );
}

function fmtShort(min: number): string {
  return min >= 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${Math.round(min)}m`;
}
