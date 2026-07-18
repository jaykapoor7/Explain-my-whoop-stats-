import { DayRecord, Insight, MetricKey, METRICS } from "./types";
import { compareGroups, fmt, mean, pearson, pearsonP, std } from "./stats";
import { generateInsights } from "./insights";

/**
 * "Ask Your Health Data" — a deterministic analyst that answers natural
 * questions using only the uploaded dataset. Every answer shows its
 * reasoning; nothing is fetched from outside the data.
 */

export interface ChatAnswer {
  content: string;
  chart?: Insight["chart"];
}

const val = (d: DayRecord, k: MetricKey) => d[k] as number | undefined;

function seriesOf(days: DayRecord[], k: MetricKey) {
  return days.filter((d) => val(d, k) !== undefined).map((d) => ({ date: d.date, value: val(d, k)! }));
}

function weekdayName(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
}

function findDate(q: string, days: DayRecord[]): DayRecord | undefined {
  const iso = q.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return days.find((d) => d.date === iso[0]);
  const lower = q.toLowerCase();
  if (lower.includes("yesterday")) return days[days.length - 2];
  if (lower.includes("today")) return days[days.length - 1];
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let w = 0; w < 7; w++) {
    if (lower.includes(weekdays[w])) {
      const isLast = lower.includes("last") || true;
      for (let i = days.length - (isLast ? 2 : 1); i >= 0; i--) {
        if (new Date(days[i].date + "T12:00:00").getDay() === w) return days[i];
      }
    }
  }
  return undefined;
}

function explainDay(d: DayRecord, days: DayRecord[]): ChatAnswer {
  const idx = days.findIndex((x) => x.date === d.date);
  const prev = idx > 0 ? days[idx - 1] : undefined;
  const hrvBase = mean(seriesOf(days, "hrv").map((s) => s.value));
  const rhrBase = mean(seriesOf(days, "rhr").map((s) => s.value));
  const sleepBase = mean(seriesOf(days, "sleepHours").map((s) => s.value));

  const factors: string[] = [];
  if (d.hrv !== undefined && isFinite(hrvBase)) {
    const diff = d.hrv - hrvBase;
    if (Math.abs(diff) > 5)
      factors.push(`HRV was ${fmt(d.hrv, 0)} ms — ${fmt(Math.abs(diff), 0)} ms ${diff < 0 ? "below" : "above"} your ${fmt(hrvBase, 0)} ms baseline.`);
  }
  if (d.rhr !== undefined && isFinite(rhrBase)) {
    const diff = d.rhr - rhrBase;
    if (Math.abs(diff) > 2)
      factors.push(`Resting HR was ${fmt(d.rhr, 0)} bpm, ${fmt(Math.abs(diff), 1)} bpm ${diff > 0 ? "above" : "below"} baseline.`);
  }
  if (d.sleepHours !== undefined && isFinite(sleepBase)) {
    const diff = d.sleepHours - sleepBase;
    if (Math.abs(diff) > 0.5)
      factors.push(`You slept ${fmt(d.sleepHours, 1)}h vs your usual ${fmt(sleepBase, 1)}h.`);
  }
  if (prev?.alcoholDrinks) factors.push(`You logged ${prev.alcoholDrinks} drink${prev.alcoholDrinks > 1 ? "s" : ""} the evening before.`);
  if (prev?.strain !== undefined && prev.strain > 14) factors.push(`The previous day carried high strain (${fmt(prev.strain, 1)}).`);
  if (d.travel || prev?.travel) factors.push(`Travel was logged around this date.`);
  if (d.sleepEfficiency !== undefined && d.sleepEfficiency < 85) factors.push(`Sleep efficiency was ${d.sleepEfficiency}% — fragmented sleep.`);
  if (prev?.lateCaffeine) factors.push(`Late caffeine was logged the day before.`);

  const header = `**${weekdayName(d.date)} ${d.date}** — recovery ${d.recovery ?? "–"}%, HRV ${d.hrv ?? "–"} ms, RHR ${d.rhr ?? "–"} bpm, sleep ${d.sleepHours ?? "–"}h.`;
  const body = factors.length
    ? `Here's what stands out:\n\n${factors.map((f) => `- ${f}`).join("\n")}`
    : `Nothing in the logged data obviously explains it — metrics were close to your baselines. Recovery scores also carry day-to-day noise; a single odd day usually isn't meaningful.`;
  return {
    content: `${header}\n\n${body}\n\n*This is pattern-matching on your logged data, not a diagnosis — single days are noisy, so weight trends over any one morning.*`,
  };
}

function driversOf(days: DayRecord[], target: MetricKey, lag: number): { label: string; r: number; n: number; p: number }[] {
  const drivers: [MetricKey, number][] = [
    ["sleepHours", lag],
    ["sleepEfficiency", lag],
    ["bedtimeHour", lag],
    ["alcoholDrinks", 1],
    ["caffeineMg", 1],
    ["strain", 1],
    ["stress", lag],
    ["proteinG", 1],
    ["screenTimeMin", lag],
  ];
  const out: { label: string; r: number; n: number; p: number }[] = [];
  for (const [k, l] of drivers) {
    if (k === target) continue;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < days.length - l; i++) {
      const x = val(days[i], k);
      const y = val(days[i + l], target);
      if (x === undefined || y === undefined) continue;
      xs.push(x);
      ys.push(y);
    }
    if (xs.length < 14) continue;
    const r = pearson(xs, ys);
    const p = pearsonP(r, xs.length);
    if (isFinite(r) && Math.abs(r) >= 0.15) out.push({ label: METRICS[k].label, r, n: xs.length, p });
  }
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

export function answerQuestion(q: string, days: DayRecord[]): ChatAnswer {
  if (days.length < 7) {
    return { content: "I don't have enough data yet — upload at least a week of history (or load the demo dataset) and I can start finding patterns." };
  }
  const lower = q.toLowerCase();
  const insights = generateInsights(days);

  // "Why was my recovery low on <day>?"
  if ((lower.includes("why") && (lower.includes("recovery") || lower.includes("hrv") || lower.includes("tired"))) || lower.match(/what happened on/)) {
    const day = findDate(q, days);
    if (day) return explainDay(day, days);
    const worst = [...days].filter((d) => d.recovery !== undefined).sort((a, b) => a.recovery! - b.recovery!)[0];
    if (worst) return explainDay(worst, days);
  }

  // "When do I get my best sleep?"
  if (lower.includes("best sleep") || (lower.includes("sleep") && lower.includes("best"))) {
    const byDow: number[][] = [[], [], [], [], [], [], []];
    for (const d of days) if (d.sleepHours !== undefined) byDow[new Date(d.date + "T12:00:00").getDay()].push(d.sleepHours);
    const avgs = byDow.map((xs, i) => ({ dow: i, avg: xs.length ? mean(xs) : NaN, n: xs.length }));
    const valid = avgs.filter((a) => isFinite(a.avg));
    const best = [...valid].sort((a, b) => b.avg - a.avg)[0];
    const worst = [...valid].sort((a, b) => a.avg - b.avg)[0];
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const early = days.filter((d) => d.bedtimeHour !== undefined && d.sleepEfficiency !== undefined && d.bedtimeHour < 23);
    const late = days.filter((d) => d.bedtimeHour !== undefined && d.sleepEfficiency !== undefined && d.bedtimeHour >= 23.5);
    let bedtimeNote = "";
    if (early.length >= 5 && late.length >= 5) {
      const e = mean(early.map((d) => d.sleepEfficiency!));
      const l = mean(late.map((d) => d.sleepEfficiency!));
      bedtimeNote = `\n- Nights you're in bed before 11pm run ${fmt(e, 0)}% efficiency vs ${fmt(l, 0)}% after 11:30pm.`;
    }
    return {
      content: `Your best sleep lands on **${names[best.dow]} nights** (${fmt(best.avg, 1)}h average over ${best.n} nights); your shortest is ${names[worst.dow]} (${fmt(worst.avg, 1)}h).${bedtimeNote}\n\nIf you want more good nights, copy what ${names[best.dow]} looks like: check that day's typical bedtime, caffeine and training timing in the Timeline.`,
      chart: {
        kind: "compare",
        metric: "sleepHours",
        groups: valid.map((a) => ({ label: names[a.dow].slice(0, 3), value: a.avg, n: a.n })),
      },
    };
  }

  // "What hurts my HRV the most?"
  if (lower.includes("hrv") && (lower.includes("hurt") || lower.includes("lower") || lower.includes("affect") || lower.includes("most") || lower.includes("drive"))) {
    const drivers = driversOf(days, "hrv", 0);
    if (!drivers.length) return { content: "I couldn't find any lifestyle variable with a meaningful relationship to your HRV yet — more logged days (especially journal entries like alcohol and caffeine) will sharpen this." };
    const negative = drivers.filter((d) => d.r < 0).slice(0, 3);
    const positive = drivers.filter((d) => d.r > 0).slice(0, 2);
    const fmtDriver = (d: { label: string; r: number; p: number; n: number }) =>
      `- **${d.label}** — r = ${fmt(d.r, 2)} over ${d.n} days${d.p < 0.05 ? " (statistically solid)" : " (weaker signal)"}`;
    return {
      content: `Ranked by strength of association with your HRV:\n\n**Working against you:**\n${negative.map(fmtDriver).join("\n") || "- nothing strongly negative"}\n\n**Working for you:**\n${positive.map(fmtDriver).join("\n") || "- nothing strongly positive yet"}\n\nThese are correlations, not proof of causation — but the top negative item is the best first target for an experiment.`,
    };
  }

  // "How much does alcohol affect me?"
  if (lower.includes("alcohol") || lower.includes("drink")) {
    const after = days.map((d, i) => ({ d, next: days[i + 1] })).filter((x) => x.next && (x.d.alcoholDrinks ?? 0) > 0);
    const clean = days.map((d, i) => ({ d, next: days[i + 1] })).filter((x) => x.next && x.d.alcoholDrinks === 0);
    if (after.length < 5) return { content: "There aren't enough logged drinking days to quantify alcohol's effect yet. Log alcohol in your journal (or upload data that includes it) and ask me again." };
    const lines: string[] = [];
    for (const k of ["hrv", "recovery", "rhr", "sleepEfficiency"] as MetricKey[]) {
      const a = after.map((x) => val(x.next!, k)).filter((v): v is number => v !== undefined);
      const c = clean.map((x) => val(x.next!, k)).filter((v): v is number => v !== undefined);
      const cmp = compareGroups(a, c);
      if (!cmp) continue;
      const meta = METRICS[k];
      lines.push(`- **${meta.label}**: ${fmt(cmp.meanA, meta.decimals)}${meta.unit} after drinking vs ${fmt(cmp.meanB, meta.decimals)}${meta.unit} otherwise (${cmp.diff > 0 ? "+" : ""}${fmt(cmp.diff, meta.decimals)}${meta.unit}${cmp.p < 0.05 ? ", solid" : ", noisy"})`);
    }
    return {
      content: `Comparing the morning after your ${after.length} drinking days with your ${clean.length} alcohol-free days:\n\n${lines.join("\n")}\n\nThe pattern is consistent with alcohol's known physiology (suppressed REM, elevated overnight HR). If you want a cleaner estimate, run the "2 weeks alcohol-free" experiment in Experiment Mode.`,
    };
  }

  // "Do I recover better after cardio or lifting?"
  if ((lower.includes("cardio") || lower.includes("run")) && (lower.includes("lift") || lower.includes("strength") || lower.includes("weights"))) {
    const cardioSports = ["running", "cycling", "hiit", "swimming", "rowing", "tennis"];
    const liftSports = ["weightlifting", "strength", "powerlifting", "crossfit"];
    const cat = (d: DayRecord) => {
      const sports = (d.workouts ?? []).map((w) => w.sport.toLowerCase());
      if (sports.some((s) => cardioSports.some((c) => s.includes(c)))) return "cardio";
      if (sports.some((s) => liftSports.some((c) => s.includes(c)))) return "lift";
      return null;
    };
    const afterCardio: number[] = [];
    const afterLift: number[] = [];
    for (let i = 0; i < days.length - 1; i++) {
      const c = cat(days[i]);
      const r = days[i + 1].recovery;
      if (r === undefined) continue;
      if (c === "cardio") afterCardio.push(r);
      if (c === "lift") afterLift.push(r);
    }
    if (afterCardio.length < 5 || afterLift.length < 5)
      return { content: "I need more workout history with sport labels to compare cardio vs lifting recovery. Upload workout exports and ask again." };
    const cmp = compareGroups(afterCardio, afterLift)!;
    const better = cmp.diff > 0 ? "cardio" : "lifting";
    return {
      content: `Next-morning recovery averages **${fmt(cmp.meanA, 0)}%** after cardio days (n=${cmp.nA}) vs **${fmt(cmp.meanB, 0)}%** after lifting days (n=${cmp.nB}).\n\nSo you recover ${Math.abs(cmp.diff) < 3 ? "about the same either way — the difference is within noise" : `somewhat better after ${better} (${fmt(Math.abs(cmp.diff), 1)} points, ${cmp.p < 0.05 ? "statistically meaningful" : "but not statistically solid yet"})`}.\n\nCaveat: session intensity isn't matched here — if your lifting days are simply harder, that, not the modality, may drive the gap.`,
      chart: {
        kind: "compare",
        metric: "recovery",
        groups: [
          { label: "After cardio", value: cmp.meanA, n: cmp.nA },
          { label: "After lifting", value: cmp.meanB, n: cmp.nB },
        ],
      },
    };
  }

  // "What changed this month?"
  if (lower.includes("changed") || lower.includes("this month") || lower.includes("different")) {
    const recent = days.slice(-30);
    const prior = days.slice(-60, -30);
    if (prior.length < 14) return { content: "I need at least ~60 days of history to compare this month against last month." };
    const lines: string[] = [];
    for (const k of ["recovery", "hrv", "rhr", "sleepHours", "sleepEfficiency", "strain", "steps"] as MetricKey[]) {
      const a = recent.map((d) => val(d, k)).filter((v): v is number => v !== undefined);
      const b = prior.map((d) => val(d, k)).filter((v): v is number => v !== undefined);
      if (a.length < 10 || b.length < 10) continue;
      const cmp = compareGroups(a, b);
      if (!cmp || Math.abs(cmp.d) < 0.3) continue;
      const meta = METRICS[k];
      const dir = cmp.diff > 0 ? "up" : "down";
      lines.push(`- **${meta.label}** is ${dir} ${fmt(Math.abs(cmp.diff), meta.decimals)}${meta.unit} vs the previous 30 days${cmp.p < 0.05 ? "" : " (weak signal)"}`);
    }
    return {
      content: lines.length
        ? `Comparing your last 30 days with the 30 before:\n\n${lines.join("\n")}\n\nAnything not listed stayed within normal variation.`
        : "Honestly? Not much — all core metrics are within normal variation vs the previous month. Stability is underrated.",
    };
  }

  // "How often do I overtrain?"
  if (lower.includes("overtrain") || lower.includes("over train") || lower.includes("too hard")) {
    let count = 0;
    const dates: string[] = [];
    for (let i = 0; i < days.length - 1; i++) {
      const today = days[i];
      const next = days[i + 1];
      if (today.strain !== undefined && today.recovery !== undefined && next.recovery !== undefined) {
        if (today.recovery < 40 && today.strain > 13 && next.recovery < 40) {
          count++;
          dates.push(today.date);
        }
      }
    }
    const weeks = Math.max(1, days.length / 7);
    return {
      content: `Using a practical definition — training hard (strain > 13) on a red/low-recovery morning (<40%) and still being low the next day — you've done it **${count} times in ${days.length} days** (~${fmt(count / (weeks / 4), 1)} times per month).${dates.length ? `\n\nMost recent: ${dates.slice(-3).reverse().join(", ")}.` : ""}\n\nOccasional overreaching is fine and even useful; the pattern to avoid is stacking several of these in one week. Check the Coach tab for load suggestions.`,
    };
  }

  // "Why has my resting heart rate increased?"
  if (lower.includes("resting heart") || lower.includes("rhr")) {
    const s = seriesOf(days, "rhr");
    if (s.length < 28) return { content: "Not enough RHR history to analyze a trend yet." };
    const recent = s.slice(-14).map((x) => x.value);
    const prior = s.slice(-28, -14).map((x) => x.value);
    const cmp = compareGroups(recent, prior);
    const drivers = driversOf(days, "rhr", 0).slice(0, 3);
    const trendLine = cmp
      ? `Your RHR averaged ${fmt(mean(recent), 1)} bpm over the last two weeks vs ${fmt(mean(prior), 1)} bpm the two weeks before (${cmp.diff > 0 ? "+" : ""}${fmt(cmp.diff, 1)} bpm${cmp.p < 0.05 ? ", a real shift" : ", within normal variation"}).`
      : "";
    return {
      content: `${trendLine}\n\nStrongest associations with RHR in your data:\n${drivers.map((d) => `- ${d.label} (r = ${fmt(d.r, 2)})`).join("\n")}\n\nCommon benign causes: alcohol, heat, travel, a hard training block, or short sleep. If RHR stays >5 bpm above baseline for a week while those are controlled — especially with poor sleep or feeling unwell — that's worth mentioning to a doctor.`,
      chart: { kind: "trend", metric: "rhr", points: s.slice(-28) },
    };
  }

  // Experiments: creatine, magnesium, etc.
  if (lower.includes("creatine") || lower.includes("magnesium") || lower.includes("supplement")) {
    return {
      content: `I can only see what's logged in your data — supplements aren't in it, so I can't directly measure that. Two options:\n\n1. Create an experiment in **Experiment Mode** with the date you started, and I'll compare before/after periods across recovery, HRV, RHR and sleep.\n2. If you know the start date already, ask me "what changed after YYYY-MM-DD".\n\nEither way I'll report honest effect sizes and flag that before/after comparisons can't fully separate the supplement from everything else that changed.`,
    };
  }

  // Fallback: overview + top insights
  const top = insights.slice(0, 3);
  const overview = [
    `- Recovery: ${fmt(mean(seriesOf(days, "recovery").map((s) => s.value)), 0)}% average over ${days.length} days`,
    `- HRV: ${fmt(mean(seriesOf(days, "hrv").map((s) => s.value)), 0)} ms · RHR: ${fmt(mean(seriesOf(days, "rhr").map((s) => s.value)), 0)} bpm`,
    `- Sleep: ${fmt(mean(seriesOf(days, "sleepHours").map((s) => s.value)), 1)}h/night at ${fmt(mean(seriesOf(days, "sleepEfficiency").map((s) => s.value)), 0)}% efficiency`,
  ].join("\n");
  return {
    content: `I'm not sure exactly what you're after, so here's where your data stands:\n\n${overview}\n\n${top.length ? `Strongest patterns I've found:\n${top.map((t) => `- ${t.headline}`).join("\n")}` : ""}\n\nTry asking things like *"What hurts my HRV the most?"*, *"Why was my recovery low last Tuesday?"* or *"How much does alcohol affect me?"*`,
  };
}

export const SUGGESTED_QUESTIONS = [
  "Why was my recovery low last Tuesday?",
  "When do I get my best sleep?",
  "What hurts my HRV the most?",
  "How much does alcohol affect me?",
  "Do I recover better after cardio or lifting?",
  "What changed this month?",
  "How often do I overtrain?",
  "Why has my resting heart rate increased?",
];
