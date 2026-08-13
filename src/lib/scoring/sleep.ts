import { Contributor, DailySummary, SleepScore } from "../types";
import { clamp } from "../format";

/**
 * SleepScoreCalculator — deterministic mock. Blends duration vs need,
 * efficiency, deep+REM share, consistency and awakenings into a 0..100 score.
 * Contributors are additive around a neutral of 50 so "what helped / hurt"
 * literally sums to the score.
 *
 * NOTE: placeholder weights. The finished algorithm will be designed separately.
 */
// Data availability — a metric that didn't sync arrives as 0, which is NOT a
// real measurement. Every calculator must exclude a missing input rather than
// score it, so the app never fabricates "0h slept" or penalizes absent data.
export const hasSleep = (d: DailySummary) => d.sleep.asleepMin > 0 || d.sleep.inBedMin > 0;
export const hasHrv = (d: DailySummary) => d.hrv.rmssdMs > 0;
export const hasRhr = (d: DailySummary) => d.rhr.bpm > 0;

/** A pillar with no underlying data for the day. Shown as "No data", never a number. */
export function unavailable(domain: SleepScore["domain"], scale: number, status: string, explanation: string): SleepScore {
  return { domain, scale, score: 0, status, explanation, deltaVsYesterday: 0, baseline: 0, contributors: [], available: false };
}

export function calcSleep(day: DailySummary): { raw: SleepScore; features: SleepFeatures } {
  const s = day.sleep;
  if (!hasSleep(day)) {
    return {
      raw: unavailable("sleep", 100, "No data", "No sleep was recorded for this night — wear your device overnight, then sync."),
      features: { deepRemMin: 0 },
    };
  }
  const deep = s.stages.deep;
  const rem = s.stages.rem;
  const deepRem = deep + rem;
  const hrs = s.asleepMin / 60;

  // Each pillar is measured against a personal or physiological target and
  // contributes signed points around a neutral base, so "what helped / hurt"
  // literally sums to the score. Targets: deep ≈ 18% and REM ≈ 21% of sleep,
  // efficiency ≈ 86%+, wake-ups ≈ 2, timing regularity ≈ 80%.
  const durGap = s.asleepMin - s.needMin;
  const terms: Contributor[] = [
    // Meeting your sleep need is the biggest lever; being short hurts more than
    // being long helps (diminishing returns past your need).
    term("Sleep duration", durGap >= 0 ? Math.min(14, durGap / 6) : Math.max(-26, durGap / 6.5),
      `${hrs.toFixed(1)}h asleep vs ${(s.needMin / 60).toFixed(1)}h need`),
    // Deep sleep — physical repair, hormone release.
    term("Deep sleep", clamp((deep - s.asleepMin * 0.18) / 7, -8, 9),
      `${Math.round(deep)}m (${pct(deep, s.asleepMin)}% of sleep)`),
    // REM — memory, mood, cognitive recovery.
    term("REM sleep", clamp((rem - s.asleepMin * 0.21) / 8, -7, 9),
      `${Math.round(rem)}m (${pct(rem, s.asleepMin)}% of sleep)`),
    // How much of your time in bed was actually asleep.
    term("Efficiency", clamp((s.efficiencyPct - 86) * 1.0, -16, 11),
      `${s.efficiencyPct}% of time in bed asleep`),
    // Fragmentation — frequent or long wake-ups blunt restoration.
    term("Restfulness", clamp(-(s.awakenings - 2) * 1.6 - Math.max(0, s.stages.awake - 30) * 0.12, -12, 3),
      `${s.awakenings} wake-ups, ${Math.round(s.stages.awake)}m awake`),
    // Going to bed and waking at consistent times strengthens your rhythm.
    term("Timing consistency", clamp((s.consistencyPct - 80) * 0.16, -9, 7),
      `${s.consistencyPct}% regular bed/wake times`),
    // Carrying a rolling shortfall vs your need drags the score down.
    term("Sleep debt", clamp(-s.debtMin / 20, -8, 2),
      s.debtMin > 0 ? `${fmtShort(s.debtMin)} rolling shortfall` : "no accrued debt"),
  ];
  const score = clamp(60 + terms.reduce((a, c) => a + c.points, 0), 5, 99);
  return {
    raw: build("sleep", 100, score, terms, sleepStatus(score), sleepExplain(terms, s, deepRem)),
    features: { deepRemMin: deepRem },
  };
}

interface SleepFeatures {
  deepRemMin: number;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const fmtShort = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${Math.round(min)}m`);

function sleepStatus(v: number): string {
  return v >= 85 ? "Excellent" : v >= 70 ? "Solid" : v >= 55 ? "Fair" : "Poor";
}

function sleepExplain(terms: Contributor[], s: DailySummary["sleep"], deepRem: number): string {
  const ranked = [...terms].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const help = ranked.find((t) => t.points > 0);
  const hurt = ranked.find((t) => t.points < 0);
  const restorePct = pct(deepRem, s.asleepMin);
  const lead = `${(s.asleepMin / 60).toFixed(1)}h asleep at ${s.efficiencyPct}% efficiency, ${restorePct}% of it restorative (deep + REM).`;
  if (help && hurt) return `${lead} Boosted most by ${help.label.toLowerCase()}, held back by ${hurt.label.toLowerCase()}.`;
  if (hurt) return `${lead} Mainly held back by ${hurt.label.toLowerCase()}.`;
  if (help) return `${lead} A strong night — led by ${help.label.toLowerCase()}.`;
  return lead;
}

// shared helpers reused by the other calculators
export function term(label: string, points: number, detail?: string): Contributor {
  const p = Math.round(points);
  return { label, points: p, kind: p > 0 ? "positive" : p < 0 ? "negative" : "neutral", detail };
}

export function build(
  domain: SleepScore["domain"],
  scale: number,
  score: number,
  contributors: Contributor[],
  status: string,
  explanation: string
): SleepScore {
  return {
    domain,
    scale,
    score: Math.round(score),
    status,
    explanation,
    deltaVsYesterday: 0,
    baseline: Math.round(score),
    contributors: contributors.filter((c) => Math.abs(c.points) >= 1).sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
  };
}
