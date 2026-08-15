import type { DailySummary } from "../types";
import { MetricKey, metricDef, series, goodnessSign } from "./metrics";
import type { LayeredMetric } from "./layered";
import type { Relationship } from "./relationships";
import type { ConfidenceLabel } from "./insights";

/**
 * The weekly "what changed and why" digest — one card, the single biggest mover
 * of the last 7 days paired with its most likely driver from the relationship
 * engine. Deterministic; leans entirely on the layered metrics + discovered
 * relationships the model already computed, so it never invents a conclusion.
 */

export interface WeeklyDigest {
  available: boolean;
  metric?: MetricKey;
  title: string;      // "HRV is trending down this week"
  detail: string;     // human numbers: "down 8% vs the week before"
  driver?: string;    // "Later bedtimes tend to precede lower HRV"
  improving: boolean; // for the UI's colour/icon — healthier direction for you
  confidence: ConfidenceLabel;
  basisDays: number;
}

const label = (c: number): ConfidenceLabel => (c >= 0.66 ? "high" : c >= 0.4 ? "moderate" : "low");

/** Mean of the last `n` non-null values ending at `end` (exclusive). */
function tailMean(xs: (number | null)[], end: number, n: number): number | null {
  const vals: number[] = [];
  for (let i = end - 1; i >= 0 && vals.length < n; i--) if (xs[i] != null) vals.push(xs[i] as number);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function weeklyDigest(layered: LayeredMetric[], relationships: Relationship[], days: DailySummary[], basisDays: number): WeeklyDigest {
  const none: WeeklyDigest = { available: false, title: "", detail: "", improving: false, confidence: "low", basisDays };
  if (days.length < 10) return none;

  // Biggest 7-day mover with enough confidence to be worth naming.
  const movers = layered
    .filter((m) => (m.trend.movement === "improving" || m.trend.movement === "declining") && m.confidence >= 0.4 && Math.abs(m.trend.zPerWeek) >= 0.4)
    .sort((a, b) => Math.abs(b.trend.zPerWeek) - Math.abs(a.trend.zPerWeek));
  const top = movers[0];
  if (!top) return none;

  const def = metricDef(top.key);
  const xs = series(days, top.key);
  const recent = tailMean(xs, days.length, 7);
  const prior = tailMean(xs, days.length - 7, 7);

  // Derive the direction word AND the numbers from the SAME raw 7-vs-7 change so
  // the headline can never contradict the detail. Orient "improving" by the
  // metric's own direction (for HRV up is good; for RHR down is good).
  const g = goodnessSign(def.dir);
  const rawDelta = recent != null && prior != null ? recent - prior : (top.trend.movement === "improving" ? g || 1 : -(g || 1));
  const pct = recent != null && prior != null && prior !== 0 ? Math.round(((recent - prior) / Math.abs(prior)) * 100) : null;
  const flat = pct != null && Math.abs(pct) < 3;
  const improving = g === 0 ? rawDelta > 0 : rawDelta * g > 0;

  const trendWord = flat ? "holding steady" : g === 0 ? (rawDelta > 0 ? "rising" : "easing") : improving ? "improving" : "sliding";
  const title = `${cap(def.label)} is ${trendWord} this week`;

  let detail: string;
  if (pct != null && recent != null && prior != null) {
    detail = flat
      ? `Your ${def.label} is holding around ${Math.round(recent)}${def.unit ? " " + def.unit : ""} — steady vs the week before.`
      : `Your ${def.label} is ${rawDelta > 0 ? "up" : "down"} ${Math.abs(pct)}% vs the week before (${Math.round(recent)}${def.unit ? " " + def.unit : ""} vs ${Math.round(prior)}).`;
  } else {
    detail = `Your ${def.label} is ${trendWord} over the last 7 days.`;
  }

  // Likely driver: a relationship that PRECEDES this metric (b === mover), strongest first.
  const rel = relationships
    .filter((r) => r.b === top.key && r.a !== top.key && r.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)[0];
  let driver: string | undefined;
  if (rel) {
    const A = metricDef(rel.a);
    const moreB = rel.direction === "positive" ? "higher" : "lower";
    const when = rel.lag > 0 ? "the next day" : "the same day";
    driver = `Higher ${A.label} tends to line up with ${moreB} ${def.label} ${when} in your data (an association, not proof).`;
  }

  return { available: true, metric: top.key, title, detail, driver, improving, confidence: label(top.confidence), basisDays };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
