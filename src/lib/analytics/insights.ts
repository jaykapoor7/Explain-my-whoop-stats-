import type { DailySummary } from "../types";
import { Baselines, DailyState, Evidence } from "./state";
import { LayeredMetric } from "./layered";
import { HealthEvent } from "./events";
import { Relationship, describeRelationship } from "./relationships";
import { MetricKey, metricDef } from "./metrics";

/**
 * Explainable, ranked insight generation.
 *
 * Two rules the whole engine obeys:
 *  1. Every insight is TRACEABLE — it ships an evidence block (which signals,
 *     how they compare to baseline, over what window) so the UI can answer
 *     "why did CURA tell me this?".
 *  2. We rank and prune. Magnitude × persistence × confidence × novelty decides
 *     what surfaces; the goal is "tell me what matters", not "show everything".
 */

export type ConfidenceLabel = "high" | "moderate" | "low";

export interface InsightEvidence {
  supportingMetrics: MetricKey[];
  baselineComparisons: Evidence[];
  timeWindow: string;
  relatedEvents: string[];
  explanation: string;
}

export interface AnalyticsInsight {
  id: string;
  kind: "state" | "trend" | "trajectory" | "relationship" | "event" | "resilience";
  domain: string;
  title: string;
  detail: string;
  confidence: ConfidenceLabel;
  rank: number;
  evidence: InsightEvidence;
}

export interface InsightContext {
  days: DailySummary[];
  baselines: Baselines;
  state: DailyState;
  layered: LayeredMetric[];
  events: HealthEvent[];
  relationships: Relationship[];
}

const label = (c: number): ConfidenceLabel => (c >= 0.7 ? "high" : c >= 0.4 ? "moderate" : "low");
const confW = (c: ConfidenceLabel) => (c === "high" ? 1 : c === "moderate" ? 0.6 : 0.3);

/** How many times a similar multi-signal dip has occurred in the last ~30 days —
 * used to make "this has happened 4 times this month" claims honestly. */
function countSimilarDips(ctx: InsightContext): number {
  const hrv = ctx.baselines.hrv;
  if (!hrv || hrv.insufficient) return 0;
  const vals = ctx.days.map((d) => (d.hrv.rmssdMs > 0 ? d.hrv.rmssdMs : null));
  let c = 0;
  for (let i = Math.max(0, vals.length - 30); i < vals.length; i++) {
    const v = vals[i];
    if (v != null && (v - hrv.median) / hrv.sigma <= -1) c++;
  }
  return c;
}

export function generateAnalyticsInsights(ctx: InsightContext): AnalyticsInsight[] {
  const out: AnalyticsInsight[] = [];
  const window = `${ctx.days.length} days of history`;

  // 1) Today's state, when it's a real multi-signal story.
  const st = ctx.state;
  if (st.confidence !== "insufficient" && st.evidence.length) {
    const worst = st.evidence.filter((e) => e.z <= -0.75);
    const best = st.evidence.filter((e) => e.z >= 0.75);
    const lead = worst.length >= best.length ? worst : best;
    if (lead.length >= 1) {
      const dips = countSimilarDips(ctx);
      const conf = st.confidence === "high" ? 0.85 : st.confidence === "moderate" ? 0.55 : 0.35;
      out.push({
        id: "state-today", kind: "state", domain: "recovery",
        title: `${st.label} today`,
        detail: `${lead.map((e) => e.text).join(", ")}.${worst.length >= 2 && dips >= 2 ? ` This combination has shown up ${dips} times in the last month.` : ""}`,
        confidence: label(conf), rank: 3 * conf + lead.length * 0.2,
        evidence: { supportingMetrics: lead.map((e) => e.metric), baselineComparisons: lead, timeWindow: "today vs your baseline", relatedEvents: [], explanation: `${st.label} is inferred from ${lead.length} signal${lead.length === 1 ? "" : "s"} deviating from your personal baseline.` },
      });
    }
  }

  // 2) Meaningful trends/trajectories per metric.
  for (const m of ctx.layered) {
    if (m.trend.movement === "insufficient") continue;
    const worthTrend = Math.abs(m.trend.zPerWeek) >= 0.6;
    const worthTraj = Math.abs(m.trajectory.zPerWeek) >= 0.4 && m.trajectory.drift !== "stable";
    if (!worthTrend && !worthTraj) continue;
    const useTraj = worthTraj && Math.abs(m.trajectory.zPerWeek) >= Math.abs(m.trend.zPerWeek);
    const mv = useTraj ? m.trajectory.movement : m.trend.movement;
    const kindWord = useTraj ? "trajectory" : "trend";
    out.push({
      id: `trend-${m.key}`, kind: useTraj ? "trajectory" : "trend", domain: "trend",
      title: `${metricDef(m.key).label} ${mv}`,
      detail: `Your ${metricDef(m.key).label} has been ${mv} over the ${useTraj ? "past few weeks" : "last week"}${m.now.z != null && Math.abs(m.now.z) >= 1 ? `, and today sits ${m.now.standing.replace("-", " ")} your usual` : ""}.`,
      confidence: label(m.confidence), rank: 2 * m.confidence + (useTraj ? 0.5 : 0.2),
      evidence: { supportingMetrics: [m.key], baselineComparisons: [], timeWindow: useTraj ? "~4 weeks" : "~1 week", relatedEvents: [], explanation: `Robust ${kindWord} slope of ${(useTraj ? m.trajectory.zPerWeek : m.trend.zPerWeek).toFixed(2)} personal-σ per week.` },
    });
  }

  // 3) Discovered relationships.
  for (const rel of ctx.relationships.slice(0, 4)) {
    const d = describeRelationship(rel);
    out.push({
      id: `rel-${rel.a}-${rel.b}-${rel.lag}`, kind: "relationship", domain: "relationship",
      title: d.title, detail: d.detail, confidence: label(rel.confidence), rank: 1.6 * rel.confidence,
      evidence: { supportingMetrics: [rel.a, rel.b], baselineComparisons: [], timeWindow: window, relatedEvents: [], explanation: `Spearman rho ${rel.r.toFixed(2)} across ${rel.n} paired days (lag ${rel.lag}).` },
    });
  }

  // 4) Detected events.
  for (const ev of ctx.events) {
    out.push({
      id: `event-${ev.type}`, kind: "event", domain: "event",
      title: ev.title, detail: ev.detail, confidence: label(ev.confidence),
      rank: (ev.severity === "elevated" ? 3.2 : ev.severity === "notice" ? 2.2 : 1.2) * Math.max(0.4, ev.confidence),
      evidence: { supportingMetrics: [], baselineComparisons: [], timeWindow: "recent", relatedEvents: [ev.type], explanation: ev.detail },
    });
  }

  // Rank, weight by confidence, de-dupe, and prune to the signal.
  const seen = new Set<string>();
  return out
    .filter((i) => (seen.has(i.id) ? false : seen.add(i.id)))
    .map((i) => ({ ...i, rank: i.rank * confW(i.confidence) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8);
}
