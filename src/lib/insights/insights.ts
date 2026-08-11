import { ScoredDay } from "../scoring/engine";
import { fmtNum } from "../format";

/**
 * Insight engine: finds observational associations between behaviors
 * (journal tags, nutrition, medication adherence) and next-day physiology.
 * Language is strictly observational — "was associated with" — and every
 * insight carries its sample size. Causation is never claimed.
 */

export interface Insight {
  id: string;
  title: string;
  detail: string;
  n: number; // supporting sample size
  strength: "clear" | "moderate" | "weak";
  domain: "sleep" | "recovery" | "energy" | "strain" | "nutrition" | "medication" | "journal";
}

interface Metric {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  get: (s: ScoredDay) => number;
}

const METRICS: Metric[] = [
  { key: "recovery", label: "next-day recovery", unit: " pts", decimals: 0, get: (s) => s.recovery.score },
  { key: "hrv", label: "overnight HRV", unit: " ms", decimals: 0, get: (s) => s.day.hrv.rmssdMs },
  { key: "sleepScore", label: "sleep score", unit: " pts", decimals: 0, get: (s) => s.sleep.score },
  { key: "sleepMin", label: "sleep duration", unit: " min", decimals: 0, get: (s) => s.day.sleep.asleepMin },
  { key: "energy", label: "next-day energy", unit: " pts", decimals: 0, get: (s) => s.energy.score },
  { key: "rhr", label: "resting heart rate", unit: " bpm", decimals: 1, get: (s) => s.day.rhr.bpm },
  { key: "mood", label: "mood", unit: " /10", decimals: 1, get: (s) => s.day.journal?.ratings.mood ?? NaN },
];

function metric(key: string): Metric {
  return METRICS.find((m) => m.key === key)!;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

/** Split days by a predicate on day i, measure a metric on day i+lag. */
function compare(
  days: ScoredDay[],
  pred: (s: ScoredDay) => boolean,
  metricKey: string,
  lag: 0 | 1
): { diff: number; pct: number; nYes: number; nNo: number; effect: number } | null {
  const m = metric(metricKey);
  const yes: number[] = [];
  const no: number[] = [];
  for (let i = 0; i < days.length - lag; i++) {
    const v = m.get(days[i + lag]);
    if (!isFinite(v)) continue;
    (pred(days[i]) ? yes : no).push(v);
  }
  if (yes.length < 6 || no.length < 6) return null;
  const diff = mean(yes) - mean(no);
  const pooled = sd([...yes, ...no]);
  if (pooled === 0) return null;
  return { diff, pct: (diff / mean(no)) * 100, nYes: yes.length, nNo: no.length, effect: Math.abs(diff) / pooled };
}

function hasTag(s: ScoredDay, label: string): boolean {
  return !!s.day.journal?.tags.some((t) => t.label === label);
}

interface Spec {
  id: string;
  label: string; // behavior name for copy
  pred: (s: ScoredDay) => boolean;
  metricKey: string;
  lag: 0 | 1;
  domain: Insight["domain"];
}

const SPECS: Spec[] = [
  { id: "smoke-hrv", label: "Smoking", pred: (s) => hasTag(s, "Smoking"), metricKey: "hrv", lag: 1, domain: "journal" },
  { id: "smoke-rec", label: "Smoking", pred: (s) => hasTag(s, "Smoking"), metricKey: "recovery", lag: 1, domain: "journal" },
  { id: "alcohol-sleep", label: "Alcohol", pred: (s) => hasTag(s, "Alcohol"), metricKey: "sleepScore", lag: 1, domain: "sleep" },
  { id: "alcohol-rec", label: "Alcohol", pred: (s) => hasTag(s, "Alcohol"), metricKey: "recovery", lag: 1, domain: "recovery" },
  { id: "football-sleep", label: "Football", pred: (s) => hasTag(s, "Football"), metricKey: "sleepMin", lag: 1, domain: "strain" },
  { id: "football-rec", label: "Football", pred: (s) => hasTag(s, "Football"), metricKey: "recovery", lag: 1, domain: "recovery" },
  { id: "highstrain-energy", label: "High-strain days (14+)", pred: (s) => s.strain.score >= 14, metricKey: "energy", lag: 1, domain: "energy" },
  { id: "goodsleep-energy", label: "8h+ sleep", pred: (s) => s.day.sleep.asleepMin >= 480, metricKey: "energy", lag: 0, domain: "energy" },
  { id: "goodsleep-rec", label: "8h+ sleep", pred: (s) => s.day.sleep.asleepMin >= 480, metricKey: "recovery", lag: 0, domain: "recovery" },
  { id: "latekcal-sleep", label: "Heavier eating days (2800+ kcal)", pred: (s) => s.nutrition.kcal >= 2800, metricKey: "sleepScore", lag: 1, domain: "nutrition" },
  { id: "protein-energy", label: "High-protein days (140g+)", pred: (s) => s.nutrition.protein >= 140, metricKey: "energy", lag: 1, domain: "nutrition" },
  {
    id: "meds-sleep",
    label: "Full medication adherence",
    pred: (s) => s.day.medicationEvents.length > 0 && s.day.medicationEvents.every((e) => e.status === "taken"),
    metricKey: "sleepScore",
    lag: 1,
    domain: "medication",
  },
  {
    id: "meds-mood",
    label: "Full medication adherence",
    pred: (s) => s.day.medicationEvents.length > 0 && s.day.medicationEvents.every((e) => e.status === "taken"),
    metricKey: "mood",
    lag: 1,
    domain: "medication",
  },
];

export function generateInsights(days: ScoredDay[]): Insight[] {
  const out: Insight[] = [];
  for (const spec of SPECS) {
    const r = compare(days, spec.pred, spec.metricKey, spec.lag);
    if (!r || r.effect < 0.25) continue;
    const m = metric(spec.metricKey);
    const dir = r.diff > 0 ? "higher" : "lower";
    const strength: Insight["strength"] = r.effect >= 0.7 ? "clear" : r.effect >= 0.45 ? "moderate" : "weak";
    const same = spec.lag === 0;
    const phr = spec.domain === "medication" ? "Logged doses were associated with" : `${spec.label} was associated with`;
    out.push({
      id: spec.id,
      title: `${spec.label} → ${fmtNum(Math.abs(r.pct), 0)}% ${dir} ${m.label}`,
      detail: `Across ${r.nYes} logged ${spec.label.toLowerCase()} days, ${phr.toLowerCase()} ${fmtNum(Math.abs(r.diff), m.decimals)}${m.unit} ${dir} ${m.label}${same ? " that day" : " the following day"} compared with the other ${r.nNo} days. This is an observed association in your data, not proof of cause.`,
      n: r.nYes + r.nNo,
      strength,
      domain: spec.domain,
    });
  }
  return out.sort((a, b) => rank(b) - rank(a));
}

function rank(i: Insight): number {
  return (i.strength === "clear" ? 3 : i.strength === "moderate" ? 2 : 1) * 100 + i.n;
}

/** Pearson correlation between two numeric metrics over the range, for Trends. */
export function correlate(
  days: ScoredDay[],
  aKey: string,
  bKey: string,
  lag: 0 | 1 = 0
): { r: number; n: number } | null {
  const A = metric(aKey);
  const B = metric(bKey);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < days.length - lag; i++) {
    const x = A.get(days[i]);
    const y = B.get(days[i + lag]);
    if (!isFinite(x) || !isFinite(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  const n = xs.length;
  if (n < 10) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return { r: num / Math.sqrt(dx * dy), n };
}
