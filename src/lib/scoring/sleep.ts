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
export function calcSleep(day: DailySummary): { raw: SleepScore; features: SleepFeatures } {
  const s = day.sleep;
  const deepRem = s.stages.deep + s.stages.rem;
  const terms: Contributor[] = [
    term("Duration", (s.asleepMin - s.needMin) / 8, `${Math.round(s.asleepMin)}m asleep vs ${s.needMin}m need`),
    term("Efficiency", (s.efficiencyPct - 88) * 1.1, `${s.efficiencyPct}% of time in bed asleep`),
    term("Deep & REM", (deepRem - s.asleepMin * 0.42) / 6, `${Math.round(deepRem)}m restorative sleep`),
    term("Consistency", (s.consistencyPct - 78) * 0.18, `${s.consistencyPct}% regular timing`),
    term("Awakenings", -(s.awakenings - 2) * 2, `${s.awakenings} awakenings`),
  ];
  const score = clamp(50 + terms.reduce((a, c) => a + c.points, 0), 5, 99);
  return {
    raw: build("sleep", 100, score, terms, sleepStatus(score), sleepExplain(terms, s)),
    features: { deepRemMin: deepRem },
  };
}

interface SleepFeatures {
  deepRemMin: number;
}

function sleepStatus(v: number): string {
  return v >= 85 ? "Excellent" : v >= 70 ? "Solid" : v >= 55 ? "Fair" : "Poor";
}

function sleepExplain(terms: Contributor[], s: DailySummary["sleep"]): string {
  const top = [...terms].sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0];
  const dir = top.points >= 0 ? "helped by" : "held back by";
  return `You slept ${Math.round(s.asleepMin / 6) / 10}h at ${s.efficiencyPct}% efficiency — mostly ${dir} ${top.label.toLowerCase()}.`;
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
