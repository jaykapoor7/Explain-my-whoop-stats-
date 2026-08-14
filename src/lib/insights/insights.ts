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

// A metric returns NaN when its underlying data didn't sync for the day; the
// isFinite guards in compare()/correlate() then exclude that day, so a missing
// value never enters an average or a correlation as a spurious 0.
const METRICS: Metric[] = [
  { key: "recovery", label: "next-day recovery", unit: " pts", decimals: 0, get: (s) => (s.recovery.available === false ? NaN : s.recovery.score) },
  { key: "hrv", label: "overnight HRV", unit: " ms", decimals: 0, get: (s) => (s.day.hrv.rmssdMs > 0 ? s.day.hrv.rmssdMs : NaN) },
  { key: "sleepScore", label: "sleep score", unit: " pts", decimals: 0, get: (s) => (s.sleep.available === false ? NaN : s.sleep.score) },
  { key: "sleepMin", label: "sleep duration", unit: " min", decimals: 0, get: (s) => (s.day.sleep.asleepMin > 0 ? s.day.sleep.asleepMin : NaN) },
  { key: "energy", label: "next-day energy", unit: " pts", decimals: 0, get: (s) => (s.energy.available === false ? NaN : s.energy.score) },
  { key: "rhr", label: "resting heart rate", unit: " bpm", decimals: 1, get: (s) => (s.day.rhr.bpm > 0 ? s.day.rhr.bpm : NaN) },
  { key: "mood", label: "mood", unit: " /10", decimals: 1, get: (s) => s.day.journal?.ratings.mood ?? NaN },
  { key: "steps", label: "daily steps", unit: " steps", decimals: 0, get: (s) => (s.day.steps > 0 ? s.day.steps : NaN) },
  { key: "strain", label: "day strain", unit: "", decimals: 1, get: (s) => (s.strain.available === false ? NaN : s.strain.score) },
  { key: "deepMin", label: "deep sleep", unit: " min", decimals: 0, get: (s) => (s.day.sleep.stages.deep > 0 ? s.day.sleep.stages.deep : NaN) },
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

function strengthOf(effect: number): Insight["strength"] {
  return effect >= 0.7 ? "clear" : effect >= 0.45 ? "moderate" : "weak";
}

/** Direction of a metric over the last 7 vs the prior 7 available readings. */
function trendInsight(days: ScoredDay[], key: string, betterWhenLower: boolean, id: string, domain: Insight["domain"], label: string): Insight | null {
  const m = metric(key);
  const vals = days.map((d) => m.get(d)).filter((v) => isFinite(v));
  if (vals.length < 14) return null;
  const recent = vals.slice(-7);
  const prior = vals.slice(-14, -7);
  const dr = mean(recent) - mean(prior);
  const pooled = sd(vals);
  if (pooled === 0) return null;
  const effect = Math.abs(dr) / pooled;
  if (effect < 0.35) return null;
  const down = dr < 0;
  const good = betterWhenLower ? down : !down;
  return {
    id,
    title: `${label} trending ${down ? "down" : "up"}`,
    detail: `Your ${m.label} averaged ${fmtNum(mean(recent), m.decimals)}${m.unit} over the last 7 days vs ${fmtNum(mean(prior), m.decimals)}${m.unit} the week before — ${good ? "a good sign, keep it going" : "worth keeping an eye on"}.`,
    n: vals.length,
    strength: strengthOf(effect),
    domain,
  };
}

/** Pearson-correlation insight between two wearable metrics. */
function corrInsight(days: ScoredDay[], aKey: string, bKey: string, lag: 0 | 1, id: string, domain: Insight["domain"], phrase: (dir: string, r: number) => { title: string; detail: string }): Insight | null {
  const c = correlate(days, aKey, bKey, lag);
  if (!c || Math.abs(c.r) < 0.32) return null;
  const dir = c.r > 0 ? "more" : "less";
  const p = phrase(dir, c.r);
  return { id, title: p.title, detail: `${p.detail} (r = ${fmtNum(c.r, 2)} across ${c.n} days — an association in your data, not proof of cause).`, n: c.n, strength: strengthOf(Math.abs(c.r)), domain };
}

/** Weekend vs weekday sleep. */
function weekendInsight(days: ScoredDay[]): Insight | null {
  const we: number[] = [], wd: number[] = [];
  for (const s of days) {
    if (s.day.sleep.asleepMin <= 0) continue;
    const dow = new Date(s.day.date + "T00:00:00").getDay();
    (dow === 0 || dow === 6 ? we : wd).push(s.day.sleep.asleepMin);
  }
  if (we.length < 4 || wd.length < 6) return null;
  const diff = mean(we) - mean(wd);
  if (Math.abs(diff) < 20) return null;
  const more = diff > 0;
  return {
    id: "weekend-sleep",
    title: `You sleep ${fmtNum(Math.abs(diff) / 60, 1)}h ${more ? "more" : "less"} on weekends`,
    detail: `Across your data, weekend nights averaged ${fmtNum(mean(we) / 60, 1)}h vs ${fmtNum(mean(wd) / 60, 1)}h on weekdays. Big swings can leave you groggy on Mondays — a steadier schedule reads better.`,
    n: we.length + wd.length,
    strength: Math.abs(diff) >= 45 ? "clear" : "moderate",
    domain: "sleep",
  };
}

export function generateInsights(days: ScoredDay[]): Insight[] {
  const out: Insight[] = [];

  // Behaviour → physiology associations (need enough logged days).
  for (const spec of SPECS) {
    const r = compare(days, spec.pred, spec.metricKey, spec.lag);
    if (!r || r.effect < 0.25) continue;
    const m = metric(spec.metricKey);
    const dir = r.diff > 0 ? "higher" : "lower";
    const same = spec.lag === 0;
    const phr = spec.domain === "medication" ? "Logged doses were associated with" : `${spec.label} was associated with`;
    out.push({
      id: spec.id,
      title: `${spec.label} → ${fmtNum(Math.abs(r.pct), 0)}% ${dir} ${m.label}`,
      detail: `Across ${r.nYes} logged ${spec.label.toLowerCase()} days, ${phr.toLowerCase()} ${fmtNum(Math.abs(r.diff), m.decimals)}${m.unit} ${dir} ${m.label}${same ? " that day" : " the following day"} compared with the other ${r.nNo} days. This is an observed association in your data, not proof of cause.`,
      n: r.nYes + r.nNo,
      strength: strengthOf(r.effect),
      domain: spec.domain,
    });
  }

  // Wearable-only insights — these fire from Fitbit data even with no journal.
  const wearable = [
    trendInsight(days, "rhr", true, "trend-rhr", "recovery", "Resting heart rate"),
    trendInsight(days, "hrv", false, "trend-hrv", "recovery", "HRV"),
    trendInsight(days, "sleepMin", false, "trend-sleep", "sleep", "Sleep duration"),
    trendInsight(days, "steps", false, "trend-steps", "strain", "Daily activity"),
    corrInsight(days, "strain", "recovery", 1, "corr-strain-rec", "recovery", (dir) => ({
      title: `Harder days → ${dir === "more" ? "higher" : "lower"} recovery next morning`,
      detail: `Days with ${dir} strain tended to be followed by ${dir === "more" ? "higher" : "lower"} recovery`,
    })),
    corrInsight(days, "steps", "sleepMin", 0, "corr-steps-sleep", "sleep", (dir) => ({
      title: `More movement → ${dir === "more" ? "more" : "less"} sleep`,
      detail: `More active days tended to bring ${dir} sleep that night`,
    })),
    corrInsight(days, "sleepMin", "energy", 0, "corr-sleep-energy", "energy", (dir) => ({
      title: `Longer sleep → ${dir === "more" ? "higher" : "lower"} energy`,
      detail: `Nights you slept more tended to bring ${dir === "more" ? "higher" : "lower"} next-day energy`,
    })),
    corrInsight(days, "deepMin", "recovery", 0, "corr-deep-rec", "recovery", (dir) => ({
      title: `More deep sleep → ${dir === "more" ? "higher" : "lower"} recovery`,
      detail: `Nights with ${dir} deep sleep tended to bring ${dir === "more" ? "higher" : "lower"} recovery`,
    })),
    weekendInsight(days),
  ].filter((x): x is Insight => x !== null);
  out.push(...wearable);

  // De-dupe by id and rank, but interleave domains so the list feels varied.
  const seen = new Set<string>();
  const ranked = out.filter((i) => (seen.has(i.id) ? false : seen.add(i.id))).sort((a, b) => rank(b) - rank(a));
  const byDomain = new Map<string, Insight[]>();
  for (const i of ranked) (byDomain.get(i.domain) ?? byDomain.set(i.domain, []).get(i.domain)!).push(i);
  const result: Insight[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const list of byDomain.values()) {
      const next = list.shift();
      if (next) { result.push(next); added = true; }
    }
  }
  return result;
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
