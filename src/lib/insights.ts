import { DayRecord, Insight, InsightCategory, MetricKey, METRICS, ChartPoint } from "./types";
import {
  compareGroups,
  confidenceTier,
  fmt,
  linearRegression,
  mean,
  pearson,
  pearsonP,
} from "./stats";

/**
 * The insight engine: runs a battery of pre-registered hypotheses over the
 * dataset, keeps the ones with statistical support, and phrases them in
 * plain English with evidence, a chart spec and a suggested experiment.
 */

const val = (d: DayRecord, k: MetricKey): number | undefined => d[k] as number | undefined;

function paired(days: DayRecord[], xKey: MetricKey, yKey: MetricKey, lag = 0) {
  const xs: number[] = [];
  const ys: number[] = [];
  const points: ChartPoint[] = [];
  for (let i = 0; i < days.length - lag; i++) {
    const x = val(days[i], xKey);
    const y = val(days[i + lag], yKey);
    if (x === undefined || y === undefined) continue;
    xs.push(x);
    ys.push(y);
    points.push({ x, y, date: days[i + lag].date });
  }
  return { xs, ys, points };
}

function split(days: DayRecord[], predicate: (d: DayRecord, i: number) => boolean | undefined, metric: MetricKey, lag = 0) {
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < days.length - lag; i++) {
    const flag = predicate(days[i], i);
    if (flag === undefined) continue;
    const v = val(days[i + lag], metric);
    if (v === undefined) continue;
    (flag ? a : b).push(v);
  }
  return { yes: a, no: b };
}

interface CompareSpec {
  id: string;
  category: InsightCategory;
  metric: MetricKey;
  lag?: number;
  predicate: (d: DayRecord, i: number, days: DayRecord[]) => boolean | undefined;
  labels: [string, string];
  headline: (diff: number, better: boolean) => string;
  explanation: string;
  experiment: string;
  minEach?: number;
}

function runCompare(days: DayRecord[], spec: CompareSpec): Insight | null {
  const { yes, no } = split(days, (d, i) => spec.predicate(d, i, days), spec.metric, spec.lag ?? 0);
  const minEach = spec.minEach ?? 6;
  if (yes.length < minEach || no.length < minEach) return null;
  const cmp = compareGroups(yes, no);
  if (!cmp || cmp.p > 0.12 || Math.abs(cmp.d) < 0.25) return null;
  const meta = METRICS[spec.metric];
  const { tier, score } = confidenceTier(cmp.p, yes.length + no.length);
  const better =
    meta.higherIsBetter === null ? cmp.diff > 0 : meta.higherIsBetter ? cmp.diff > 0 : cmp.diff < 0;
  return {
    id: spec.id,
    category: spec.category,
    headline: spec.headline(cmp.diff, better),
    confidence: tier,
    confidenceScore: score,
    evidence: [
      `${spec.labels[0]}: avg ${meta.shortLabel} ${fmt(cmp.meanA, meta.decimals)}${meta.unit} across ${cmp.nA} days`,
      `${spec.labels[1]}: avg ${meta.shortLabel} ${fmt(cmp.meanB, meta.decimals)}${meta.unit} across ${cmp.nB} days`,
      `Difference: ${cmp.diff > 0 ? "+" : ""}${fmt(cmp.diff, meta.decimals)}${meta.unit} (effect size d = ${fmt(Math.abs(cmp.d), 2)}, p ≈ ${cmp.p < 0.001 ? "<0.001" : fmt(cmp.p, 3)})`,
    ],
    explanation: spec.explanation,
    experiment: spec.experiment,
    chart: {
      kind: "compare",
      metric: spec.metric,
      groups: [
        { label: spec.labels[0], value: cmp.meanA, n: cmp.nA },
        { label: spec.labels[1], value: cmp.meanB, n: cmp.nB },
      ],
    },
    stats: { n: cmp.nA + cmp.nB, p: cmp.p, effect: cmp.d },
  };
}

interface CorrSpec {
  id: string;
  category: InsightCategory;
  xKey: MetricKey;
  yKey: MetricKey;
  lag?: number;
  headline: (r: number) => string;
  explanation: string;
  experiment: string;
}

function runCorrelation(days: DayRecord[], spec: CorrSpec): Insight | null {
  const { xs, ys, points } = paired(days, spec.xKey, spec.yKey, spec.lag ?? 0);
  if (xs.length < 14) return null;
  const r = pearson(xs, ys);
  const p = pearsonP(r, xs.length);
  if (!isFinite(r) || Math.abs(r) < 0.25 || p > 0.1) return null;
  const reg = linearRegression(xs, ys);
  const { tier, score } = confidenceTier(p, xs.length);
  const xMeta = METRICS[spec.xKey];
  const yMeta = METRICS[spec.yKey];
  return {
    id: spec.id,
    category: spec.category,
    headline: spec.headline(r),
    confidence: tier,
    confidenceScore: score,
    evidence: [
      `Correlation r = ${fmt(r, 2)} across ${xs.length} paired days (p ≈ ${p < 0.001 ? "<0.001" : fmt(p, 3)})`,
      `Each extra ${xMeta.unit || "unit"} of ${xMeta.label.toLowerCase()} is associated with ${reg.slope > 0 ? "+" : ""}${fmt(reg.slope, 2)}${yMeta.unit} ${yMeta.shortLabel}`,
      `${xMeta.shortLabel} range in your data: ${fmt(Math.min(...xs), xMeta.decimals)}–${fmt(Math.max(...xs), xMeta.decimals)}${xMeta.unit}`,
    ],
    explanation: spec.explanation,
    experiment: spec.experiment,
    chart: {
      kind: "scatter",
      xKey: spec.xKey,
      yKey: spec.yKey,
      points,
      trend: { slope: reg.slope, intercept: reg.intercept },
    },
    stats: { n: xs.length, r, p },
  };
}

function trendInsight(days: DayRecord[], metric: MetricKey, category: InsightCategory): Insight | null {
  const withVal = days.filter((d) => val(d, metric) !== undefined);
  if (withVal.length < 42) return null;
  const recent = withVal.slice(-21).map((d) => val(d, metric)!);
  const prior = withVal.slice(-42, -21).map((d) => val(d, metric)!);
  const cmp = compareGroups(recent, prior);
  if (!cmp || cmp.p > 0.08 || Math.abs(cmp.d) < 0.4) return null;
  const meta = METRICS[metric];
  const rising = cmp.diff > 0;
  const good = meta.higherIsBetter === null ? null : meta.higherIsBetter === rising;
  const { tier, score } = confidenceTier(cmp.p, 42);
  const pct = Math.abs((cmp.diff / cmp.meanB) * 100);
  return {
    id: `trend-${metric}`,
    category,
    headline: `Your ${meta.label.toLowerCase()} has ${rising ? "risen" : "fallen"} ${fmt(pct, 0)}% over the last three weeks${good === true ? " — a good sign" : good === false ? " — worth watching" : ""}.`,
    confidence: tier,
    confidenceScore: score,
    evidence: [
      `Last 3 weeks: avg ${fmt(cmp.meanA, meta.decimals)}${meta.unit}`,
      `Previous 3 weeks: avg ${fmt(cmp.meanB, meta.decimals)}${meta.unit}`,
      `Shift of ${cmp.diff > 0 ? "+" : ""}${fmt(cmp.diff, meta.decimals)}${meta.unit} (p ≈ ${fmt(cmp.p, 3)})`,
    ],
    explanation: `A sustained multi-week shift in ${meta.label.toLowerCase()} usually reflects a real change in training, sleep, stress or health — not day-to-day noise. Think about what changed around ${withVal.slice(-21)[0].date}.`,
    experiment:
      good === false
        ? `Pick the most likely driver (sleep timing, training load, stress) and change one variable for two weeks while watching ${meta.shortLabel}.`
        : `Identify what you changed three weeks ago and keep doing it — consistency is what turns a streak into a baseline.`,
    chart: {
      kind: "trend",
      metric,
      points: withVal.slice(-42).map((d) => ({ date: d.date, value: val(d, metric)! })),
    },
    stats: { n: 42, p: cmp.p, effect: cmp.d },
  };
}

export function generateInsights(days: DayRecord[]): Insight[] {
  if (days.length < 14) return [];
  const insights: Insight[] = [];
  const isWeekend = (d: DayRecord) => {
    const dow = new Date(d.date + "T12:00:00").getDay();
    return dow === 0 || dow === 6;
  };

  const compareSpecs: CompareSpec[] = [
    {
      id: "sleep7-hrv",
      category: "sleep",
      metric: "hrv",
      predicate: (d) => (d.sleepHours === undefined ? undefined : d.sleepHours >= 7),
      labels: ["Nights with 7h+ sleep", "Nights under 7h"],
      headline: (diff) =>
        `Your HRV is ${fmt(Math.abs(diff), 0)} ms ${diff > 0 ? "higher" : "lower"} after sleeping more than 7 hours.`,
      explanation:
        "Longer sleep gives your parasympathetic nervous system more time in deep and REM stages, which typically shows up as higher morning HRV. This is one of the most reliable levers in most people's data.",
      experiment: "Protect a 7.5h sleep opportunity for 14 consecutive nights and compare your average HRV to the prior two weeks.",
    },
    {
      id: "weekend-recovery",
      category: "recovery",
      metric: "recovery",
      predicate: (d) => isWeekend(d),
      labels: ["Weekends", "Weekdays"],
      headline: (diff) => `You recover ${diff > 0 ? "significantly better" : "worse"} on weekends (${diff > 0 ? "+" : ""}${fmt(diff, 0)} points).`,
      explanation:
        diffExplainWeekend,
      experiment: "Try moving one weekday closer to your weekend routine — e.g. no alarm on Wednesday or a lighter Friday session — and see if mid-week recovery lifts.",
    },
    {
      id: "alcohol-hrv",
      category: "lifestyle",
      metric: "hrv",
      lag: 1,
      predicate: (d) => (d.alcoholDrinks === undefined ? undefined : d.alcoholDrinks > 0),
      labels: ["After drinking", "Alcohol-free days"],
      headline: (diff) => `Alcohol is followed by a ${fmt(Math.abs(diff), 0)} ms ${diff < 0 ? "drop" : "rise"} in next-morning HRV.`,
      explanation:
        "Alcohol suppresses REM sleep and keeps heart rate elevated overnight while your body metabolizes it. The next-morning HRV dip is one of the clearest signals wearables pick up.",
      experiment: "Run a 2-week alcohol-free block and compare HRV, RHR and sleep efficiency to your drinking weeks.",
    },
    {
      id: "alcohol-recovery",
      category: "lifestyle",
      metric: "recovery",
      lag: 1,
      predicate: (d) => (d.alcoholDrinks === undefined ? undefined : d.alcoholDrinks >= 2),
      labels: ["After 2+ drinks", "Other days"],
      headline: (diff) => `Two or more drinks cost you about ${fmt(Math.abs(diff), 0)} recovery points the next morning.`,
      explanation:
        "The dose matters: a single drink often barely registers, but two or more reliably degrades overnight autonomic recovery in most datasets, including yours.",
      experiment: "Cap drinks at one on social nights for three weekends and compare Sunday/Monday recovery to previous weekends.",
    },
    {
      id: "late-workout-sleep",
      category: "activity",
      metric: "sleepEfficiency",
      lag: 1,
      predicate: (d) => {
        if (!d.workouts?.length) return undefined;
        const starts = d.workouts.map((w) => w.startHour).filter((h): h is number => h !== undefined);
        if (!starts.length) return undefined;
        return Math.max(...starts) >= 18;
      },
      labels: ["Evening workouts (6pm+)", "Earlier workouts"],
      headline: (diff) =>
        `Late workouts are associated with ${fmt(Math.abs(diff), 1)}% ${diff < 0 ? "lower" : "higher"} sleep efficiency that night.`,
      explanation:
        "Training close to bedtime raises core temperature and sympathetic arousal, which can fragment early-night sleep. Some people are unaffected — your data suggests you are not one of them.",
      experiment: "For two weeks, finish workouts before 6pm and compare sleep efficiency and deep sleep to your evening-session weeks.",
      minEach: 5,
    },
    {
      id: "strain-sleep",
      category: "activity",
      metric: "sleepHours",
      lag: 1,
      predicate: (d) => (d.strain === undefined ? undefined : d.strain >= 14.5),
      labels: ["After high-strain days", "After easier days"],
      headline: (diff) =>
        `You sleep ${fmt(Math.abs(diff) * 60, 0)} minutes ${diff > 0 ? "longer" : "less"} after high-strain training days.`,
      explanation:
        "Hard training raises sleep pressure (adenosine) and your body extends sleep to repay the recovery cost. This is adaptive — the risk is only when a hard day *doesn't* buy you extra sleep.",
      experiment: "After your next three high-strain days, go to bed 30 minutes earlier and check whether next-day recovery beats your historical post-strain average.",
    },
    {
      id: "travel-rhr",
      category: "heart",
      metric: "rhr",
      lag: 0,
      predicate: (d) => d.travel,
      labels: ["Travel days", "Home days"],
      headline: (diff) => `Your resting heart rate ${diff > 0 ? "spikes" : "drops"} about ${fmt(Math.abs(diff), 1)} bpm on travel days.`,
      explanation:
        "Dehydration, disrupted routines, altitude/pressure changes and poorer sleep all push RHR up when you travel. Expect 2–4 days to return to baseline after long trips.",
      experiment: "On your next trip: extra water in transit, no alcohol on the flight, and a walk on arrival — then compare RHR to past travel days.",
      minEach: 4,
    },
    {
      id: "meditation-hrv",
      category: "lifestyle",
      metric: "hrv",
      lag: 1,
      predicate: (d) => d.meditation,
      labels: ["Meditation days", "Other days"],
      headline: (diff) => `Days you meditate are followed by ${diff > 0 ? "higher" : "lower"} HRV (+${fmt(Math.abs(diff), 1)} ms).`,
      explanation:
        "Down-regulation practices shift autonomic balance toward parasympathetic dominance. The effect is small per-day but compounds as a habit.",
      experiment: "Meditate daily for 14 days straight (any 10-minute protocol) and compare average HRV to your non-practice baseline.",
      minEach: 8,
    },
    {
      id: "late-caffeine-sleep",
      category: "lifestyle",
      metric: "sleepEfficiency",
      lag: 1,
      predicate: (d) => d.lateCaffeine,
      labels: ["Late-caffeine days", "Other days"],
      headline: (diff) => `Caffeine late in the day is associated with ${fmt(Math.abs(diff), 1)}% ${diff < 0 ? "lower" : "higher"} sleep efficiency.`,
      explanation:
        "Caffeine's half-life is 5–6 hours, so an afternoon coffee still blocks a meaningful share of adenosine receptors at bedtime — shallower sleep even when you fall asleep fine.",
      experiment: "Move your caffeine cutoff to 2pm for two weeks and compare sleep efficiency and deep sleep.",
      minEach: 6,
    },
  ];

  for (const spec of compareSpecs) {
    const ins = runCompare(days, spec);
    if (ins) insights.push(ins);
  }

  // Two consecutive green days -> next-day strain capacity
  const greenPair = runCompare(days, {
    id: "green-streak",
    category: "recovery",
    metric: "strain",
    lag: 1,
    predicate: (d, i, all) => {
      if (i === 0) return undefined;
      const prev = all[i - 1];
      if (d.recovery === undefined || prev.recovery === undefined) return undefined;
      return d.recovery >= 67 && prev.recovery >= 67;
    },
    labels: ["After 2 green days", "Other days"],
    headline: (diff) => `You take on ${fmt(Math.abs(diff), 1)} ${diff > 0 ? "more" : "less"} strain after two consecutive green recovery days.`,
    explanation:
      "Back-to-back high-recovery days indicate your body has fully absorbed recent load — these are the days to schedule your hardest sessions.",
    experiment: "Plan your next two key workouts to land on days following consecutive 67%+ recoveries and compare session quality.",
    minEach: 6,
  });
  if (greenPair) insights.push(greenPair);

  const corrSpecs: CorrSpec[] = [
    {
      id: "bedtime-recovery",
      category: "sleep",
      xKey: "bedtimeHour",
      yKey: "recovery",
      lag: 0,
      headline: (r) => `Later bedtimes track with ${r < 0 ? "lower" : "higher"} recovery scores.`,
      explanation:
        "Your circadian rhythm front-loads deep sleep in the early night. Pushing bedtime later shifts sleep architecture even when total duration is unchanged.",
      experiment: "Hold a 11pm lights-out for 10 weekdays and compare recovery to your late-night baseline.",
    },
    {
      id: "protein-recovery",
      category: "lifestyle",
      xKey: "proteinG",
      yKey: "recovery",
      lag: 1,
      headline: (r) => `Higher-protein days are followed by ${r > 0 ? "better" : "worse"} recovery.`,
      explanation:
        "Adequate protein supports overnight muscle repair, which reduces the physiological stress your recovery score measures. Correlation here may also reflect generally better routines on high-protein days.",
      experiment: "Hit 1.6 g/kg protein daily for two weeks and compare recovery on matched training loads.",
    },
    {
      id: "stress-sleep",
      category: "lifestyle",
      xKey: "stress",
      yKey: "sleepEfficiency",
      lag: 0,
      headline: (r) => `Higher-stress days come with ${r < 0 ? "worse" : "better"} sleep efficiency that night.`,
      explanation:
        "Elevated evening cortisol delays sleep onset and increases night wakings. Note the arrow can run both ways — poor sleep also raises next-day stress.",
      experiment: "Add a 15-minute wind-down (no screens, dim light) on high-stress days and watch whether the efficiency gap narrows.",
    },
    {
      id: "screen-sleep",
      category: "lifestyle",
      xKey: "screenTimeMin",
      yKey: "sleepHours",
      lag: 0,
      headline: (r) => `Heavy screen days are associated with ${r < 0 ? "shorter" : "longer"} sleep.`,
      explanation:
        "The mechanism is usually displacement — screen time eats into your sleep window — more than blue light per se.",
      experiment: "Set an app limit that ends entertainment screens 45 minutes before your target bedtime for two weeks.",
    },
  ];
  for (const spec of corrSpecs) {
    const ins = runCorrelation(days, spec);
    if (ins) insights.push(ins);
  }

  for (const [metric, category] of [
    ["hrv", "heart"],
    ["rhr", "heart"],
    ["recovery", "recovery"],
    ["sleepHours", "sleep"],
    ["strain", "activity"],
  ] as [MetricKey, InsightCategory][]) {
    const ins = trendInsight(days, metric, category);
    if (ins) insights.push(ins);
  }

  return insights.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

const diffExplainWeekend =
  "Weekend recovery gaps usually come from extra sleep (no alarm), lower work stress, or lighter training — but weekend alcohol can mask an even bigger underlying gap. Check the alcohol insight alongside this one.";
