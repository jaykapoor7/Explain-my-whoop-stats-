import { DayRecord, MetricKey, METRICS } from "./types";
import { compareGroups, fmt, mean } from "./stats";
import { generateInsights } from "./insights";

/** AI Coach: daily briefing, weekly report, monthly review, suggestions. */

const val = (d: DayRecord, k: keyof DayRecord) => {
  const v = d[k];
  return typeof v === "number" ? v : undefined;
};
const series = (days: DayRecord[], k: keyof DayRecord) =>
  days.map((d) => val(d, k)).filter((v): v is number => v !== undefined);

export interface Briefing {
  title: string;
  status: "green" | "yellow" | "red";
  summary: string;
  bullets: string[];
  action: string;
}

export function dailyBriefing(days: DayRecord[]): Briefing | null {
  if (!days.length) return null;
  const today = days[days.length - 1];
  const prev = days[days.length - 2];
  const rec = today.recovery;
  const baseHrv = mean(series(days.slice(-30), "hrv"));
  const status: Briefing["status"] = rec === undefined ? "yellow" : rec >= 67 ? "green" : rec >= 34 ? "yellow" : "red";

  const bullets: string[] = [];
  if (today.hrv !== undefined && isFinite(baseHrv)) {
    const diff = today.hrv - baseHrv;
    bullets.push(`HRV ${fmt(today.hrv, 0)} ms (${diff >= 0 ? "+" : ""}${fmt(diff, 0)} vs 30-day baseline)`);
  }
  if (today.rhr !== undefined) bullets.push(`Resting HR ${fmt(today.rhr, 0)} bpm`);
  if (today.sleepHours !== undefined) {
    const need = today.sleepNeedHours;
    bullets.push(
      `Slept ${fmt(today.sleepHours, 1)}h${need ? ` of a ${fmt(need, 1)}h need (${today.sleepHours >= need ? "fully repaid" : `${fmt((need - today.sleepHours) * 60, 0)} min short`})` : ""}`
    );
  }
  if (today.sleepDebtHours !== undefined && today.sleepDebtHours > 1.5)
    bullets.push(`Sleep debt is building: ${fmt(today.sleepDebtHours, 1)}h accumulated`);
  if (prev?.strain !== undefined && prev.strain > 14) bullets.push(`Yesterday was a big day (strain ${fmt(prev.strain, 1)})`);
  if (prev?.alcoholDrinks) bullets.push(`Alcohol logged last night (${prev.alcoholDrinks} drink${prev.alcoholDrinks > 1 ? "s" : ""})`);

  const action =
    status === "green"
      ? "Your body is primed — this is the day for your hardest planned session. Push intensity, not just volume."
      : status === "yellow"
        ? "Train, but keep it controlled: moderate intensity, quality technique, finish feeling like you had one more gear."
        : "Prioritize recovery: light movement only (walk, easy spin, mobility), protein at every meal, and protect tonight's sleep window.";

  return {
    title: `Morning briefing — ${new Date(today.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
    status,
    summary:
      rec === undefined
        ? "No recovery score for today yet."
        : `You woke up at ${rec}% recovery — ${status === "green" ? "well recovered" : status === "yellow" ? "moderately recovered" : "under-recovered"}.`,
    bullets,
    action,
  };
}

export interface PeriodReport {
  title: string;
  stats: { label: string; value: string; delta: string; good: boolean | null }[];
  narrative: string[];
}

function periodReport(days: DayRecord[], length: number, label: string): PeriodReport | null {
  if (days.length < length * 1.5) return null;
  const current = days.slice(-length);
  const prior = days.slice(-length * 2, -length);
  const keys: MetricKey[] = ["recovery", "hrv", "rhr", "sleepHours", "sleepEfficiency", "strain", "steps"];
  const stats: PeriodReport["stats"] = [];
  const narrative: string[] = [];

  for (const k of keys) {
    const a = series(current, k);
    const b = series(prior, k);
    if (a.length < length / 3) continue;
    const meta = METRICS[k];
    const cur = mean(a);
    const delta = b.length >= length / 3 ? cur - mean(b) : NaN;
    const good = !isFinite(delta) || meta.higherIsBetter === null ? null : meta.higherIsBetter === delta > 0;
    stats.push({
      label: meta.label,
      value: `${fmt(cur, meta.decimals)}${meta.unit}`,
      delta: isFinite(delta) ? `${delta >= 0 ? "+" : ""}${fmt(delta, meta.decimals)}${meta.unit}` : "–",
      good,
    });
    if (b.length >= length / 3) {
      const cmp = compareGroups(a, b);
      if (cmp && cmp.p < 0.05 && Math.abs(cmp.d) > 0.35) {
        narrative.push(
          `${meta.label} moved ${cmp.diff > 0 ? "up" : "down"} meaningfully (${cmp.diff > 0 ? "+" : ""}${fmt(cmp.diff, meta.decimals)}${meta.unit}) vs the previous ${label.toLowerCase()} — ${good === true ? "keep whatever changed." : good === false ? "worth identifying what changed." : "check whether that matches your training plan."}`
        );
      }
    }
  }

  const greens = current.filter((d) => (d.recovery ?? 0) >= 67).length;
  const reds = current.filter((d) => d.recovery !== undefined && d.recovery < 34).length;
  narrative.unshift(
    `${greens} green ${greens === 1 ? "day" : "days"} and ${reds} red ${reds === 1 ? "day" : "days"} out of ${current.length}. ${reds > current.length / 4 ? "That's a lot of red — your load is likely outrunning your recovery." : greens > current.length / 2 ? "A strong block — your body is absorbing the load well." : "A balanced block overall."}`
  );
  if (!narrative.length) narrative.push("All metrics stable vs the prior period — a steady block.");
  return { title: label, stats, narrative };
}

export const weeklyReport = (days: DayRecord[]) => periodReport(days, 7, "Weekly report");
export const monthlyReport = (days: DayRecord[]) => periodReport(days, 30, "Monthly review");

export interface Suggestion {
  area: "training" | "sleep" | "recovery";
  text: string;
  why: string;
}

export function suggestions(days: DayRecord[]): Suggestion[] {
  const out: Suggestion[] = [];
  if (days.length < 14) return out;
  const last14 = days.slice(-14);

  const sleepAvg = mean(series(last14, "sleepHours"));
  const needAvg = mean(series(last14, "sleepNeedHours"));
  if (isFinite(sleepAvg) && isFinite(needAvg) && needAvg - sleepAvg > 0.4) {
    out.push({
      area: "sleep",
      text: `Go to bed ${fmt((needAvg - sleepAvg) * 60, 0)} minutes earlier for the next two weeks.`,
      why: `You're averaging ${fmt(sleepAvg, 1)}h against a ${fmt(needAvg, 1)}h need — a chronic shortfall that caps recovery.`,
    });
  }

  const bedtimes = series(last14, "bedtimeHour");
  if (bedtimes.length >= 8) {
    const spread = Math.max(...bedtimes) - Math.min(...bedtimes);
    if (spread > 2.5)
      out.push({
        area: "sleep",
        text: "Tighten your bedtime window to ±45 minutes.",
        why: `Your bedtime varied by ${fmt(spread, 1)} hours over the last two weeks; consistency improves sleep efficiency more than duration for most people.`,
      });
  }

  const insights = generateInsights(days);
  const alc = insights.find((i) => i.id === "alcohol-recovery" || i.id === "alcohol-hrv");
  if (alc) out.push({ area: "recovery", text: "Cap alcohol at one drink, and not within 3 hours of bed.", why: alc.headline });
  const late = insights.find((i) => i.id === "late-caffeine-sleep");
  if (late) out.push({ area: "sleep", text: "Move your caffeine cutoff to 2 PM.", why: late.headline });
  const lateWo = insights.find((i) => i.id === "late-workout-sleep");
  if (lateWo) out.push({ area: "training", text: "Schedule hard sessions before 6 PM where possible.", why: lateWo.headline });

  const reds = last14.filter((d) => d.recovery !== undefined && d.recovery < 34);
  const highStrainOnRed = last14.filter((d) => (d.recovery ?? 100) < 34 && (d.strain ?? 0) > 13).length;
  if (highStrainOnRed >= 2)
    out.push({
      area: "training",
      text: "Add one full recovery day after heavy sessions when you wake up red.",
      why: `You trained hard on ${highStrainOnRed} red-recovery mornings in the last two weeks — that pattern extends the hole you're in.`,
    });
  else if (reds.length === 0 && mean(series(last14, "strain")) < 11)
    out.push({
      area: "training",
      text: "You have headroom — add one harder session this week.",
      why: "No red days in two weeks and moderate average strain suggest your body can absorb more load.",
    });

  return out.slice(0, 5);
}

export function experimentIdeas(days: DayRecord[]): { name: string; description: string; metrics: MetricKey[] }[] {
  const insights = generateInsights(days);
  const ideas: { name: string; description: string; metrics: MetricKey[] }[] = [];
  if (insights.some((i) => i.id.startsWith("alcohol")))
    ideas.push({ name: "Two dry weeks", description: "No alcohol for 14 days; compare HRV, RHR and sleep efficiency to your baseline.", metrics: ["hrv", "rhr", "sleepEfficiency"] });
  if (insights.some((i) => i.id === "late-caffeine-sleep"))
    ideas.push({ name: "2 PM caffeine cutoff", description: "No caffeine after 2 PM for two weeks; watch sleep efficiency and deep sleep.", metrics: ["sleepEfficiency", "deepHours"] });
  if (insights.some((i) => i.id === "bedtime-recovery" || i.id === "sleep7-hrv"))
    ideas.push({ name: "11 PM lights-out", description: "In bed by 11 PM for 10 weekdays; compare recovery and HRV.", metrics: ["recovery", "hrv"] });
  ideas.push({ name: "Daily 10-minute meditation", description: "Any breathwork or meditation protocol, every day for two weeks.", metrics: ["hrv", "stress"] });
  ideas.push({ name: "Evening walk", description: "20-minute walk after dinner instead of screens.", metrics: ["sleepEfficiency", "rhr"] });
  return ideas.slice(0, 4);
}
