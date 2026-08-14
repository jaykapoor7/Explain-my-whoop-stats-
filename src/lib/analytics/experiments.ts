import type { DailySummary } from "../types";
import { MetricKey, metricDef } from "./metrics";
import { DriverSpec, estimateResponse, ResponseEstimate } from "./response";

/**
 * Personal experiment service. A reusable data model — NOT a hardcoded UI —
 * for "does X help me?". Define a hypothesis (a driver behaviour and the
 * outcomes to watch), and CURA compares comparable days to estimate the effect
 * and its confidence. Observational by construction; it never claims proof.
 */

export interface Experiment {
  id: string;
  title: string;
  driver: DriverSpec;
  outcomes: MetricKey[];
  lag?: number;
  /** only use days on/after this ISO date (an actual intervention period) */
  since?: string;
}

export interface ExperimentOutcome extends ResponseEstimate {
  outcomeLabel: string;
}

export interface ExperimentResult {
  id: string;
  title: string;
  outcomes: ExperimentOutcome[];
  overallConfidence: ResponseEstimate["confidence"];
  summary: string;
}

const rank = { insufficient: 0, low: 1, moderate: 2, high: 3 } as const;

export function runExperiment(days: DailySummary[], exp: Experiment): ExperimentResult {
  const scoped = exp.since ? days.filter((d) => d.date >= exp.since!) : days;
  const lag = exp.lag ?? 1;
  const outcomes: ExperimentOutcome[] = [];
  for (const key of exp.outcomes) {
    const est = estimateResponse(scoped, exp.driver, key, lag);
    if (est) outcomes.push({ ...est, outcomeLabel: metricDef(key).label });
  }
  const worst = outcomes.reduce<ResponseEstimate["confidence"]>((acc, o) => (rank[o.confidence] < rank[acc] ? o.confidence : acc), "high");
  const overallConfidence = outcomes.length ? worst : "insufficient";

  const parts = outcomes
    .filter((o) => o.direction !== "flat")
    .map((o) => `${o.diff > 0 ? "+" : ""}${Math.round(o.pct)}% ${o.outcomeLabel}`);
  const summary = outcomes.length
    ? `Across ${Math.min(...outcomes.map((o) => o.n))}+ comparable days: ${parts.join(", ") || "no clear effect"}. Confidence: ${overallConfidence}.`
    : "Not enough comparable days yet to estimate an effect.";

  return { id: exp.id, title: exp.title, outcomes, overallConfidence, summary };
}

/** A few ready-made experiments CURA can auto-run when the data supports them. */
export function suggestedExperiments(): Experiment[] {
  return [
    {
      id: "earlier-bedtime",
      title: "Does an earlier bedtime help my recovery?",
      driver: { kind: "behavior", id: "early-bed", label: "Earlier bedtime", present: (d) => {
        const h = new Date(d.sleep.bedtime).getHours();
        return h >= 20 && h < 23; // before 11pm (and not a daytime artefact)
      } },
      outcomes: ["hrv", "rhr", "sleepMin"],
      lag: 1,
    },
    {
      id: "high-steps",
      title: "Do more active days improve my sleep?",
      driver: { kind: "behavior", id: "active", label: "More active day", present: (d) => d.steps >= 9000 },
      outcomes: ["sleepMin", "sleepEff"],
      lag: 0,
    },
  ];
}
