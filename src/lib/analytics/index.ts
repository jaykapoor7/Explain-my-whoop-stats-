import type { DailySummary } from "../types";
import { baselineFor, BaselineStat } from "./baseline";
import { METRIC_DEFS, MetricKey, series } from "./metrics";
import { Baselines, computeDailyState, DailyState } from "./state";
import { layerMetric, LayeredMetric } from "./layered";
import { computeTrajectory, HealthTrajectory } from "./trajectory";
import { computeResilience, ResilienceReport } from "./resilience";
import { discoverRelationships, Relationship } from "./relationships";
import { detectEvents, HealthEvent } from "./events";
import { computeHealthAge, HealthAgeModel } from "./health-age";
import { AnalyticsInsight, generateAnalyticsInsights } from "./insights";
import { weeklyDigest, WeeklyDigest } from "./digest";

/**
 * CURA Personal Health Model — the orchestrator.
 *
 * Pipeline (each stage a separate, testable module, none of it inside React):
 *   raw DailySummary[]  (already normalised by every connector)
 *     → personal baselines      (baseline.ts)
 *     → NOW/TREND/TRAJECTORY     (layered.ts)
 *     → daily state + dimensions (state.ts)
 *     → resilience               (resilience.ts)
 *     → overall trajectory       (trajectory.ts)
 *     → relationships            (relationships.ts)
 *     → events                   (events.ts)
 *     → Health Age               (health-age.ts)
 *     → ranked, explainable insights (insights.ts)
 *
 * The model degrades gracefully: with little data it says so (learning stage +
 * confidence) instead of inventing personalised conclusions.
 */

export type LearningStage = "new" | "learning" | "baseline-established" | "personalized" | "high-confidence";

export interface DataQuality {
  totalDays: number;
  coreCoverageDays: number;   // days with HRV or RHR
  missingnessPct: number;     // share of recent 30 days with no core signal
  longestGapDays: number;
  metricsAvailable: MetricKey[];
  note: string;
}

export interface PersonalHealthModel {
  stage: LearningStage;
  stageMessage: string;
  baselines: Baselines;
  layered: LayeredMetric[];
  state: DailyState;
  trajectory: HealthTrajectory;
  resilience: ResilienceReport;
  relationships: Relationship[];
  events: HealthEvent[];
  healthAge: HealthAgeModel;
  insights: AnalyticsInsight[];
  digest: WeeklyDigest;
  dataQuality: DataQuality;
}

function dataQuality(days: DailySummary[]): DataQuality {
  const core = days.map((d) => d.hrv.rmssdMs > 0 || d.rhr.bpm > 0);
  const coreCoverageDays = core.filter(Boolean).length;
  const recent = core.slice(-30);
  const missingnessPct = recent.length ? Math.round((recent.filter((x) => !x).length / recent.length) * 100) : 100;
  let longestGap = 0, cur = 0;
  for (const ok of core) { if (ok) cur = 0; else longestGap = Math.max(longestGap, ++cur); }
  const metricsAvailable = METRIC_DEFS.filter((m) => series(days, m.key).some((v) => v != null)).map((m) => m.key);
  return {
    totalDays: days.length, coreCoverageDays, missingnessPct, longestGapDays: longestGap, metricsAvailable,
    note: missingnessPct > 40 ? "Sparse recent data — wear your device consistently for sharper reads." : "Data coverage looks healthy.",
  };
}

function stageFor(hrv: BaselineStat | undefined, rhr: BaselineStat | undefined): { stage: LearningStage; message: string } {
  const n = Math.max(hrv?.n ?? 0, rhr?.n ?? 0);
  const conf = Math.max(hrv?.confidence ?? 0, rhr?.confidence ?? 0);
  if (n < 3) return { stage: "new", message: "CURA is just getting started — connect a device and give it a few nights." };
  if (n < 7) return { stage: "learning", message: `CURA is learning your baseline — about ${7 - n} more nights until your first personalised reads.` };
  if (n < 14) return { stage: "baseline-established", message: `Your baseline is established. ${14 - n} more nights unlocks trend and relationship detection.` };
  if (n < 30 || conf < 0.75) return { stage: "personalized", message: "Personalised model active. Reliability keeps climbing as history grows." };
  return { stage: "high-confidence", message: "High-confidence personal model — trends and relationships are on solid footing." };
}

export function analyzeUser(days: DailySummary[], opts: { actualAge?: number } = {}): PersonalHealthModel {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  const baselines: Baselines = {};
  for (const def of METRIC_DEFS) {
    const stat = baselineFor(series(sorted, def.key), def.dir, { windowDays: 60, minObs: def.minObs });
    stat.key = def.key;
    baselines[def.key] = stat;
  }

  const layered = METRIC_DEFS.map((d) => layerMetric(d.key, baselines[d.key]!));
  const state = computeDailyState(baselines);
  const trajectory = computeTrajectory(baselines);
  const resilience = computeResilience(sorted);
  const relationships = discoverRelationships(sorted);
  const events = detectEvents(sorted, baselines);
  const healthAge = computeHealthAge(sorted, opts.actualAge);
  const insights = generateAnalyticsInsights({ days: sorted, baselines, state, layered, events, relationships });
  const quality = dataQuality(sorted);
  const digest = weeklyDigest(layered, relationships, sorted, quality.coreCoverageDays);
  const { stage, message } = stageFor(baselines.hrv, baselines.rhr);

  return {
    stage, stageMessage: message, baselines, layered, state, trajectory, resilience,
    relationships, events, healthAge, insights, digest, dataQuality: quality,
  };
}

export * from "./metrics";
export * from "./baseline";
export * from "./state";
export * from "./layered";
export * from "./trajectory";
export * from "./resilience";
export * from "./relationships";
export * from "./events";
export * from "./health-age";
export * from "./insights";
export * from "./digest";
export * from "./response";
export * from "./experiments";
