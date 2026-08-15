import { Contributor, DailySummary, PersonalBaseline, SleepScore } from "../types";
import { clamp, softScore } from "../format";

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
/** Reference point = "you at your own baseline": your personal sleep need,
 * your typical stage architecture and efficiency. Meeting your need with ordinary
 * quality lands in the high 80s (WHOOP-style "sleep performance"). Every factor
 * is a signed move off this personal reference, not a fixed textbook target.
 * Calibrated so a solid night lands in the high 80s, tracking the Fitbit/Google
 * Health sleep score (same data source): duration ~50%, deep/REM ~25%,
 * restoration ~25%. */
export const SLEEP_BASE = 70;

export const hasSleep = (d: DailySummary) => d.sleep.asleepMin > 0 || d.sleep.inBedMin > 0;
export const hasHrv = (d: DailySummary) => d.hrv.rmssdMs > 0;
export const hasRhr = (d: DailySummary) => d.rhr.bpm > 0;

/** A pillar with no underlying data for the day. Shown as "No data", never a number. */
export function unavailable(domain: SleepScore["domain"], scale: number, status: string, explanation: string): SleepScore {
  return { domain, scale, score: 0, status, explanation, deltaVsYesterday: 0, baseline: 0, contributors: [], available: false };
}

export function calcSleep(day: DailySummary, baseline?: PersonalBaseline): { raw: SleepScore; features: SleepFeatures } {
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
  // Personal references: judge stages and efficiency against YOUR own typical,
  // falling back to population physiology only until your baseline exists.
  const deepTarget = baseline?.deepPct && baseline.deepPct > 0 ? baseline.deepPct : 0.18;
  const remTarget = baseline?.remPct && baseline.remPct > 0 ? baseline.remPct : 0.21;
  const effTarget = baseline?.sleepEffPct && baseline.sleepEffPct > 0 ? baseline.sleepEffPct : 86;

  // Each pillar is measured against a personal or physiological target and
  // contributes signed points around a neutral base, so "what helped / hurt"
  // literally sums to the score. Targets: deep ≈ 18% and REM ≈ 21% of sleep,
  // efficiency ≈ 86%+, wake-ups ≈ 2, timing regularity ≈ 80%.
  // Meeting your personal sleep NEED is the dominant lever — WHOOP-style "sleep
  // performance" (% of need met). Hitting your need scores strongly; extra sleep
  // gives a small bonus; falling short costs progressively but gently.
  const pctNeed = s.needMin > 0 ? s.asleepMin / s.needMin : 1;
  const durPts = clamp((pctNeed - 0.87) * 130, -24, 18);
  const terms: Contributor[] = [
    term("Sleep duration", durPts,
      `${hrs.toFixed(1)}h asleep vs ${(s.needMin / 60).toFixed(1)}h need (${Math.round(pctNeed * 100)}% of need)`),
    // Deep sleep vs YOUR typical share — physical repair, hormone release.
    term("Deep sleep", clamp((deep - s.asleepMin * deepTarget) / 9, -5, 7),
      `${Math.round(deep)}m (${pct(deep, s.asleepMin)}% vs your ${Math.round(deepTarget * 100)}% typical)`),
    // REM vs YOUR typical share — memory, mood, cognitive recovery.
    term("REM sleep", clamp((rem - s.asleepMin * remTarget) / 10, -5, 7),
      `${Math.round(rem)}m (${pct(rem, s.asleepMin)}% vs your ${Math.round(remTarget * 100)}% typical)`),
    // How much of your time in bed was actually asleep, vs your own norm.
    term("Efficiency", clamp((s.efficiencyPct - effTarget) * 0.8, -10, 12),
      `${s.efficiencyPct}% asleep vs your ${Math.round(effTarget)}% typical`),
    // Fragmentation — frequent or long wake-ups blunt restoration.
    term("Restfulness", clamp(-(s.awakenings - 2) * 1.2 - Math.max(0, s.stages.awake - 35) * 0.1, -6, 3),
      `${s.awakenings} wake-ups, ${Math.round(s.stages.awake)}m awake`),
    // Going to bed and waking at consistent times strengthens your rhythm.
    term("Timing consistency", clamp((s.consistencyPct - 80) * 0.14, -7, 6),
      `${s.consistencyPct}% regular bed/wake times`),
    // The nightly sleep score mirrors Fitbit/Google Health — it scores THIS
    // night. Rolling multi-day debt is a readiness concept (it carries strong
    // weight in Recovery), so here it's only a light nudge.
    term("Sleep debt", clamp(-(s.debtMin / 60) * 1, -4, 2),
      s.debtMin > 0 ? `${fmtShort(s.debtMin)} rolling shortfall` : "no accrued debt"),
  ];
  const score = softScore(SLEEP_BASE + terms.reduce((a, c) => a + c.points, 0));
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

/** Lowercase a factor label for mid-sentence use, but keep acronyms uppercase. */
export function lc(label: string): string {
  return label
    .toLowerCase()
    .replace(/\bhrv\b/g, "HRV")
    .replace(/\brhr\b/g, "RHR")
    .replace(/\bhr\b/g, "HR")
    .replace(/\brem\b/g, "REM");
}

function sleepExplain(terms: Contributor[], s: DailySummary["sleep"], deepRem: number): string {
  const ranked = [...terms].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const help = ranked.find((t) => t.points > 0);
  const hurt = ranked.find((t) => t.points < 0);
  const restorePct = pct(deepRem, s.asleepMin);
  const lead = `${(s.asleepMin / 60).toFixed(1)}h asleep at ${s.efficiencyPct}% efficiency, ${restorePct}% of it restorative (deep + REM).`;
  if (help && hurt) return `${lead} Boosted most by ${lc(help.label)}, held back by ${lc(hurt.label)}.`;
  if (hurt) return `${lead} Mainly held back by ${lc(hurt.label)}.`;
  if (help) return `${lead} A strong night — led by ${lc(help.label)}.`;
  return lead;
}

// shared helpers reused by the other calculators
export function term(label: string, points: number, detail?: string, extra?: { group?: Contributor["group"]; math?: string }): Contributor {
  const p = Math.round(points);
  return { label, points: p, kind: p > 0 ? "positive" : p < 0 ? "negative" : "neutral", detail, ...extra };
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
