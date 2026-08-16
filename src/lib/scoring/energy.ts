import { Contributor, DailySummary, EnergyScore, PersonalBaseline, ScoreResult } from "../types";
import { clamp, softScore } from "../format";
import { build, hasHrv, term, unavailable } from "./sleep";
import { countedActivities, estimateActivityLoad } from "./strain";

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
 *   2. SPEND — today's counted activity draws the tank down from there, via a
 *      logarithmic transform of the SAME personalised strain load Strain
 *      shows for that activity (not a 1:1 copy of the number — diminishing
 *      returns as effort climbs), plus a small linear term for all-day
 *      ambient movement (steps), mirroring Strain's own ambient term.
 *
 * Energy now = morning capacity − spend. Every term is signed and grouped so
 * the UI can show "you woke with X, you've spent Y, you have Z left".
 */

/** Physiological anchor for morning capacity — an average night with average
 * recovery and a normal day behind you lands near here. Set on the generous side
 * so a typical day reads as usable energy rather than a harsh middling score.
 * Readiness and yesterday's load move you off it; NOT shown as a flat "neutral". */
export const ENERGY_ANCHOR = 52;

/** Scale for the log curve below — tune this one constant to make activity
 * spend feel heavier or lighter overall. */
const ACTIVITY_SPEND_SCALE = 6;

/** Strain load → energy points spent, on a LOGARITHMIC curve, not 1:1.
 * A strain of 14 does not cost 14 energy points — the first bit of exertion
 * costs a real, noticeable chunk of your tank, but each additional unit of
 * strain on top of an already-hard effort costs progressively less (the way
 * "one more hard set" barely registers once you're already deep into a
 * session). Monotonic and capped well below the 21 max, since even an
 * all-out day shouldn't zero out your entire energy budget from one activity. */
export function energySpendForLoad(load: number): number {
  if (!(load > 0)) return 0;
  return Math.round(clamp(ACTIVITY_SPEND_SCALE * Math.log1p(load), 1, 20));
}

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
  const morningCapacity = softScore(ENERGY_ANCHOR + capTerms.reduce((a, c) => a + c.points, 0));
  const spent = Math.round(Math.abs(spend.reduce((a, c) => a + c.points, 0)));
  return { morningCapacity, spent };
}

export function calcEnergy(
  day: DailySummary,
  baseline: PersonalBaseline,
  sleep: ScoreResult,
  recovery: ScoreResult,
  prevStrain: number,
  hr: { restHr?: number; maxHr?: number } = {},
  /** Real wall-clock "now" (epoch ms), passed ONLY for the day that is
   * actually in progress right now — lets energy keep draining through the
   * day from ordinary wakefulness, even between syncs, so you can check "how
   * much do I have left" at any point and not just after a workout. Omit (or
   * leave undefined) for any completed/historical day. */
  now?: number
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
  const sleepRef = baseline.sleep && baseline.sleep > 0 ? baseline.sleep : 72;
  const recRef = baseline.recovery && baseline.recovery > 0 ? baseline.recovery : 66;
  if (sleepOk) {
    const pts = Math.round(cl((sleep.score - sleepRef) * 0.35, -16, 14));
    capacity.push(term("Sleep", pts, `Last night ${Math.round(sleep.score)} vs your ${Math.round(sleepRef)} typical`, {
      group: "capacity",
      math: `Sleep ${Math.round(sleep.score)} vs your ${Math.round(sleepRef)} typical → ${pts >= 0 ? "+" : ""}${pts}. A better-than-usual night charges the tank; worse starts you lower.`,
    }));
  }
  if (recoveryOk) {
    const pts = Math.round(cl((recovery.score - recRef) * 0.3, -14, 12));
    capacity.push(term("Recovery", pts, `${Math.round(recovery.score)}% vs your ${Math.round(recRef)}% typical`, {
      group: "capacity",
      math: `Recovery ${Math.round(recovery.score)}% vs your ${Math.round(recRef)}% typical → ${pts >= 0 ? "+" : ""}${pts}. Your autonomic readiness relative to your own normal.`,
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

  const morningCapacity = softScore(ENERGY_ANCHOR + capacity.reduce((a, c) => a + c.points, 0));

  // ---------- Phase 2: spend (today's activity draws it down) ----------
  // Start from the same personalised load Strain shows for this activity
  // (HR-reserve based, via the user's own resting/max HR) — but the ENERGY
  // COST of that load is logarithmic, not a 1:1 copy of the strain number.
  // Diminishing returns: the first chunk of exertion costs the most; extra
  // strain on an already-hard effort costs progressively less.
  const loadOf = (a: (typeof day.activities)[number]) => (a.avgHr > 0 ? estimateActivityLoad(a.durationMin, a.avgHr, hr.restHr, hr.maxHr) : a.load);
  const spend = countedActivities(day).map((a) => {
    const load = loadOf(a);
    const pts = -energySpendForLoad(load);
    return term(a.type, pts, `${a.durationMin}m${a.avgHr > 0 ? ` at avg ${a.avgHr} bpm` : ""}`, {
      group: "spend",
      math: `${a.type} carried ${load.toFixed(1)} strain — the same load shown on Strain. Energy cost is logarithmic (diminishing returns as effort climbs), not a 1:1 copy of the strain number: ${ACTIVITY_SPEND_SCALE}×ln(1+${load.toFixed(1)}) → ${pts}.`,
    });
  });
  // All-day movement spends too, even with no formal workout — mirrors
  // Strain's "Daily movement" ambient term so a normal active day (walking,
  // errands) isn't stuck at a flat 0 spend just because you didn't log a gym
  // session. Capped low so it can't dominate a real workout day.
  if (day.steps > 0) {
    const ambient = -Math.round(clamp(day.steps / 2500, 0, 5));
    if (ambient !== 0) {
      spend.push(term("Daily movement", ambient, `${day.steps.toLocaleString()} steps`, {
        group: "spend",
        math: `${day.steps.toLocaleString()} steps today — all-day movement spends a little energy even without a workout → ${ambient}.`,
      }));
    }
  }
  // Ordinary wakefulness spends too — even sitting still, your energy eases
  // across the day (homeostatic sleep pressure builds the longer you're
  // awake). Only for the day actually in progress right now, using real
  // wall-clock time, so this is what makes "how much do I have left at 3pm"
  // meaningfully different from "at 9am" even with no new activity synced.
  // Linear and capped low — activity remains the dominant spend.
  if (now != null && day.sleep.wake) {
    const wakeMs = Date.parse(day.sleep.wake);
    if (isFinite(wakeMs) && now > wakeMs) {
      const hoursAwake = clamp((now - wakeMs) / 3_600_000, 0, 18);
      const pts = -Math.round(clamp(hoursAwake * 0.9, 0, 14));
      if (pts <= -1) {
        spend.push(term("Time awake", pts, `${hoursAwake.toFixed(1)}h since waking`, {
          group: "spend",
          math: `${hoursAwake.toFixed(1)}h awake since ${fmtHM(day.sleep.wake)} — energy eases gradually across the day even without activity, capped at 14 → ${pts}. Updates as the day goes on.`,
        }));
      }
    }
  }

  const terms = [...capacity, ...spend];
  const score = softScore(morningCapacity + spend.reduce((a, c) => a + c.points, 0));
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

/**
 * Energy is a WAKE-PERIOD battery, not a calendar-day score — it resets when you
 * sleep, not at midnight. Once the clock rolls past 00:00 and the new day has no
 * sleep/HRV yet, `calcEnergy` returns "no data" (you can't score a morning you
 * haven't had). But you should still be able to check how much you have left
 * until you actually sleep. This carries the last real Energy forward and keeps
 * it draining for the hours you've been awake — the same curve the live score
 * uses — so the number stays meaningful across midnight instead of blanking.
 */
export function carryEnergy(src: EnergyScore, wakeIso: string | undefined, now: number, tzOffsetMin?: number): EnergyScore {
  const wakeMs = wakeIso
    ? tzOffsetMin != null
      ? Date.parse(wakeIso + "Z") - tzOffsetMin * 60_000
      : Date.parse(wakeIso)
    : NaN;
  let decay = 0;
  if (isFinite(wakeMs) && now > wakeMs) {
    const hoursAwake = clamp((now - wakeMs) / 3_600_000, 0, 18);
    decay = Math.round(clamp(hoursAwake * 0.9, 0, 14));
  }
  const contributors = [...src.contributors];
  if (decay > 0) {
    contributors.push(
      term("Time awake", -decay, "carried across midnight", {
        group: "spend",
        math: `You haven't slept since your last reading, so yesterday's battery carries over and keeps easing — about ${decay} for the hours you've been awake. It resets to a fresh morning capacity once you sleep.`,
      }),
    );
  }
  const score = Math.max(1, Math.min(99, Math.round(src.score - decay)));
  const status = score >= 70 ? "Charged" : score >= 45 ? "Steady" : score >= 25 ? "Draining" : "Depleted";
  return build(
    "energy",
    100,
    score,
    contributors,
    status,
    "You haven't slept since your last reading, so your energy carries over from then and keeps easing with time awake — it resets to a fresh morning capacity once you sleep.",
  );
}

function fmtShort(min: number): string {
  return min >= 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${Math.round(min)}m`;
}

function fmtHM(iso: string): string {
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
