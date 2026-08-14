import type { DailySummary } from "../types";
import { Baselines } from "./state";

/**
 * Meaningful-event detection. Optimised for signal over noise: single-day blips
 * don't fire — an event needs either a large, agreeing deviation today or a
 * sustained run. Language stays observational and non-diagnostic.
 */

export type EventType =
  | "recovery-crash" | "strong-recovery" | "sustained-low-hrv" | "sustained-high-rhr"
  | "sleep-disruption" | "emerging-fatigue" | "improvement-streak" | "high-load-spike";

export interface HealthEvent {
  type: EventType;
  severity: "info" | "notice" | "elevated";
  date: string;
  title: string;
  detail: string;
  confidence: number;
}

export function detectEvents(days: DailySummary[], b: Baselines): HealthEvent[] {
  const out: HealthEvent[] = [];
  const today = days.length ? days[days.length - 1].date : "";
  const hrv = b.hrv, rhr = b.rhr, sleep = b.sleepMin, strain = b.strainLoad;
  const conf = (...xs: (number | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, c) => a + c, 0) / v.length : 0;
  };

  const hrvLow = hrv && !hrv.insufficient && hrv.z != null && hrv.z <= -1.75;

  // Recovery crash — agreeing autonomic drop today.
  if (hrvLow && rhr && !rhr.insufficient && rhr.z != null && rhr.z >= 1) {
    out.push({ type: "recovery-crash", severity: "elevated", date: today, confidence: conf(hrv!.confidence, rhr.confidence),
      title: "Recovery crash", detail: `HRV is well below your baseline and resting HR is up — a clear autonomic dip today.` });
  }
  // Unusually strong recovery.
  if (hrv && !hrv.insufficient && hrv.z != null && hrv.z >= 1.75) {
    out.push({ type: "strong-recovery", severity: "info", date: today, confidence: hrv.confidence,
      title: "Primed", detail: `HRV is well above your baseline — a strong recovery signal.` });
  }
  // Sustained runs.
  if (hrv && hrv.sustainedDays >= 4) {
    out.push({ type: "sustained-low-hrv", severity: "elevated", date: today, confidence: hrv.confidence,
      title: `HRV suppressed ${hrv.sustainedDays} days`, detail: `HRV has sat below your usual range for ${hrv.sustainedDays} days running.` });
  }
  if (rhr && rhr.sustainedDays >= 4) {
    out.push({ type: "sustained-high-rhr", severity: "notice", date: today, confidence: rhr.confidence,
      title: `Resting HR elevated ${rhr.sustainedDays} days`, detail: `Resting heart rate has run above your baseline for ${rhr.sustainedDays} days.` });
  }
  // Sleep disruption.
  if (sleep && !sleep.insufficient && ((sleep.z != null && sleep.z <= -1.75) || sleep.sustainedDays >= 3)) {
    out.push({ type: "sleep-disruption", severity: "notice", date: today, confidence: sleep.confidence,
      title: "Sleep disruption", detail: `Sleep has been notably shorter than your normal recently.` });
  }
  // Emerging fatigue — multi-signal trend, not one day.
  const declining = (s?: typeof hrv, good = 1) => s && !s.insufficient && s.shortTrend.zPerWeek * good <= -0.5;
  if (declining(hrv, 1) && declining(rhr, -1) && !hrvLow) {
    out.push({ type: "emerging-fatigue", severity: "notice", date: today, confidence: conf(hrv?.confidence, rhr?.confidence),
      title: "Emerging fatigue", detail: `HRV is trending down while resting HR trends up over the past week — worth easing off.` });
  }
  // Improvement streak.
  if (hrv && !hrv.insufficient && hrv.longTrend.zPerWeek >= 0.4 && hrv.drift === "rising") {
    out.push({ type: "improvement-streak", severity: "info", date: today, confidence: hrv.confidence,
      title: "HRV trending up", detail: `Your HRV baseline has been drifting upward — your autonomic fitness is improving.` });
  }
  // High-load spike.
  if (strain && !strain.insufficient && strain.z != null && strain.z >= 2) {
    out.push({ type: "high-load-spike", severity: "info", date: today, confidence: strain.confidence,
      title: "Big training load", detail: `Today's load is well above your usual — expect recovery to lean on it tomorrow.` });
  }

  return out.filter((e) => e.confidence >= 0.25).sort((a, b) => (b.severity === "elevated" ? 1 : 0) - (a.severity === "elevated" ? 1 : 0));
}
