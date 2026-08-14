import type { BaselineStat } from "./baseline";
import { MetricKey, metricDef, goodnessSign } from "./metrics";
import { clamp, squash } from "./stats";

/**
 * Context-aware daily state + personalised health dimensions.
 *
 * A dimension index is NOT a population score — it's centred on YOUR baseline
 * (sitting at your normal reads ~65) and moves with how far today's signals sit
 * from your normal, in your own spread. Several agreeing signals outweigh one
 * loud one, and every dimension carries a confidence and its own evidence, so
 * "low recovery" backed by four signals reads differently from one noisy HRV.
 */

export type Baselines = Partial<Record<MetricKey, BaselineStat>>;

export interface Evidence {
  metric: MetricKey;
  text: string;      // "HRV 17% below your baseline"
  z: number;         // signed, oriented so - = worse for you
  confidence: number;
}

export interface Dimension {
  key: string;
  label: string;
  index: number | null;   // 0..100, personalised (null = insufficient)
  standing: "strong" | "typical" | "soft" | "learning";
  confidence: number;
  evidence: Evidence[];
}

export interface DailyState {
  label: string;          // "Primed", "Low recovery", "Balanced", "Elevated load"...
  confidence: "high" | "moderate" | "low" | "insufficient";
  evidence: Evidence[];
  dimensions: Dimension[];
}

// which metrics feed each dimension (all oriented via goodnessDeviation)
const DIMENSIONS: { key: string; label: string; metrics: MetricKey[] }[] = [
  // sleepHr is deliberately excluded here — it's near-collinear with rhr and
  // would double-count the same cardiac signal when judging agreement.
  { key: "recovery", label: "Recovery", metrics: ["hrv", "rhr", "sleepMin", "sleepEff"] },
  { key: "cardiovascular", label: "Cardiovascular", metrics: ["hrv", "rhr", "sleepHr"] },
  { key: "sleep", label: "Sleep", metrics: ["sleepMin", "sleepEff", "sleepConsistency", "deepMin", "remMin"] },
  { key: "activity", label: "Activity", metrics: ["steps", "activeCalories", "strainLoad"] },
  { key: "stress", label: "Stress load", metrics: ["hrv", "rhr"] }, // inverted below
];

function evidenceText(key: MetricKey, stat: BaselineStat): Evidence | null {
  if (stat.insufficient || stat.z == null || stat.current == null) return null;
  const g = goodnessSign(metricDef(key).dir) || 1;
  const orientedZ = stat.z * g; // - = worse for you
  const def = metricDef(key);
  const pct = stat.median ? Math.round(((stat.current - stat.median) / stat.median) * 100) : 0;
  const absPct = Math.abs(pct);
  const dirWord = stat.current >= stat.median ? "above" : "below";
  // Prefer % for ratio-ish metrics; absolute delta for HR-type metrics reads better.
  const body =
    key === "rhr" || key === "sleepHr"
      ? `${Math.abs(Math.round(stat.current - stat.median))} bpm ${dirWord} your baseline`
      : `${absPct}% ${dirWord} your baseline`;
  return { metric: key, text: `${def.label} ${body}`, z: orientedZ, confidence: stat.confidence };
}

function dimension(key: string, label: string, metrics: MetricKey[], baselines: Baselines, invert = false): Dimension {
  const parts: { z: number; w: number; ev: Evidence }[] = [];
  for (const m of metrics) {
    const stat = baselines[m];
    if (!stat || stat.insufficient || stat.z == null) continue;
    const ev = evidenceText(m, stat);
    if (!ev) continue;
    parts.push({ z: ev.z, w: Math.max(0.15, stat.confidence), ev });
  }
  if (!parts.length) return { key, label, index: null, standing: "learning", confidence: 0, evidence: [] };

  const wSum = parts.reduce((s, p) => s + p.w, 0);
  let goodZ = parts.reduce((s, p) => s + p.z * p.w, 0) / wSum; // + = better for you
  if (invert) goodZ = -goodZ;
  const index = Math.round(clamp(65 + 22 * squash(goodZ), 2, 100));
  const confidence = clamp((wSum / parts.length) * clamp(parts.length / 3, 0.4, 1), 0, 1);
  const standing = index >= 72 ? "strong" : index >= 48 ? "typical" : "soft";
  const evidence = parts.map((p) => p.ev).sort((a, b) => a.z - b.z); // worst first
  return { key, label, index, standing, confidence, evidence };
}

export function computeDailyState(baselines: Baselines): DailyState {
  const dims = DIMENSIONS.map((d) => dimension(d.key, d.label, d.metrics, baselines, d.key === "stress"));

  const recovery = dims.find((d) => d.key === "recovery")!;
  const load = dims.find((d) => d.key === "activity")!;

  // Headline from recovery, but only claim high confidence when signals agree.
  let label = "Balanced";
  if (recovery.index != null) {
    if (recovery.index >= 72) label = "Primed";
    else if (recovery.index >= 55) label = "Balanced";
    else if (recovery.index >= 42) label = "Moderate";
    else label = "Low recovery";
  } else if (load.index != null && load.index >= 75) label = "Elevated load";
  else label = "Learning your baseline";

  // Confidence comes from AGREEMENT, not raw deviation count: signals must lean
  // the same way as the headline. A worse-HRV-but-better-sleep day is genuinely
  // ambiguous and must NOT read as high confidence.
  const worse = recovery.evidence.filter((e) => e.z <= -0.75).length;
  const better = recovery.evidence.filter((e) => e.z >= 0.75).length;
  const lowState = recovery.index != null && recovery.index < 50;
  const highState = recovery.index != null && recovery.index >= 72;
  const agree = lowState ? worse : highState ? better : Math.max(worse, better) === Math.min(worse, better) && worse > 0 ? 1 : Math.max(worse, better);
  const confidence: DailyState["confidence"] =
    recovery.index == null ? "insufficient" : agree >= 3 ? "high" : agree >= 2 ? "moderate" : "low";

  return { label, confidence, evidence: recovery.evidence, dimensions: dims };
}
