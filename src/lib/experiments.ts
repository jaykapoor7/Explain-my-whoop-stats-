import { DayRecord, Experiment, MetricKey, METRICS } from "./types";
import { compareGroups, fmt, GroupComparison } from "./stats";

/**
 * Experiment analysis: compares a window before the start date with the
 * period after it, per target metric. Reports effect sizes and is explicit
 * that this is an observational before/after comparison, not a controlled trial.
 */

export interface MetricResult {
  metric: MetricKey;
  before: number;
  after: number;
  diff: number;
  p: number;
  d: number;
  nBefore: number;
  nAfter: number;
  verdict: "improved" | "declined" | "no-change";
  meaningful: boolean;
}

export interface ExperimentAnalysis {
  daysRunning: number;
  results: MetricResult[];
  summary: string;
  caveat: string;
}

export function analyzeExperiment(exp: Experiment, days: DayRecord[]): ExperimentAnalysis | null {
  const startIdx = days.findIndex((d) => d.date >= exp.startDate);
  if (startIdx < 0) return null;
  const after = days.slice(startIdx);
  const windowLen = Math.max(14, Math.min(28, after.length));
  const before = days.slice(Math.max(0, startIdx - windowLen), startIdx);
  if (after.length < 5 || before.length < 7) {
    return {
      daysRunning: after.length,
      results: [],
      summary:
        after.length < 5
          ? `Only ${after.length} day${after.length === 1 ? "" : "s"} in — I need at least 5 days after the start date before comparing. Keep going.`
          : "Not enough baseline data before the start date to compare against.",
      caveat: "",
    };
  }

  const results: MetricResult[] = [];
  for (const metric of exp.targetMetrics) {
    const meta = METRICS[metric];
    const a = after.map((d) => d[metric] as number | undefined).filter((v): v is number => v !== undefined);
    const b = before.map((d) => d[metric] as number | undefined).filter((v): v is number => v !== undefined);
    const cmp: GroupComparison | null = compareGroups(a, b);
    if (!cmp) continue;
    const meaningful = cmp.p < 0.05 && Math.abs(cmp.d) >= 0.35;
    const better = meta.higherIsBetter === null ? null : meta.higherIsBetter ? cmp.diff > 0 : cmp.diff < 0;
    results.push({
      metric,
      before: cmp.meanB,
      after: cmp.meanA,
      diff: cmp.diff,
      p: cmp.p,
      d: cmp.d,
      nBefore: cmp.nB,
      nAfter: cmp.nA,
      verdict: !meaningful ? "no-change" : better === false ? "declined" : "improved",
      meaningful,
    });
  }

  const improved = results.filter((r) => r.verdict === "improved");
  const declined = results.filter((r) => r.verdict === "declined");
  let summary: string;
  if (!results.length) summary = "None of the target metrics have enough data on both sides of the start date yet.";
  else if (improved.length && !declined.length)
    summary = `Evidence points the right way: ${improved.map((r) => `${METRICS[r.metric].shortLabel} ${r.diff > 0 ? "+" : ""}${fmt(r.diff, METRICS[r.metric].decimals)}${METRICS[r.metric].unit}`).join(", ")} since you started — shifts large enough that chance alone is an unlikely explanation.`;
  else if (declined.length && !improved.length)
    summary = `The tracked metrics have moved in the wrong direction since the start date (${declined.map((r) => METRICS[r.metric].shortLabel).join(", ")}). That doesn't necessarily mean the experiment caused it — check what else changed.`;
  else if (improved.length && declined.length) summary = "Mixed picture: some metrics improved while others declined. Worth running longer before drawing conclusions.";
  else summary = "No statistically meaningful change in the target metrics so far. Either the effect is small, or it needs more time to show.";

  return {
    daysRunning: after.length,
    results,
    summary,
    caveat:
      "This is a before/after comparison of observational data, not a controlled trial — training changes, seasons, stress and anything else you changed at the same time are all bundled into the difference. Treat it as evidence, not proof of causation.",
  };
}

export const EXPERIMENT_TEMPLATES: { name: string; description: string; metrics: MetricKey[] }[] = [
  { name: "No caffeine after lunch", description: "Hard 1 PM caffeine cutoff.", metrics: ["sleepEfficiency", "deepHours", "sleepHours"] },
  { name: "Cold showers", description: "2–3 minutes cold exposure each morning.", metrics: ["hrv", "recovery", "mood"] },
  { name: "Creatine", description: "5 g creatine monohydrate daily.", metrics: ["recovery", "strain"] },
  { name: "Magnesium before bed", description: "Magnesium glycinate ~1h before sleep.", metrics: ["deepHours", "sleepEfficiency", "hrv"] },
  { name: "Daily meditation", description: "10+ minutes of any meditation practice.", metrics: ["hrv", "stress", "rhr"] },
  { name: "8-hour sleep opportunity", description: "In bed 8.5 hours every night.", metrics: ["recovery", "hrv", "sleepDebtHours"] },
  { name: "Walk after dinner", description: "20-minute walk instead of couch time.", metrics: ["sleepEfficiency", "rhr"] },
];
