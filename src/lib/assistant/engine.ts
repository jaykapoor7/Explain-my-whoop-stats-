import { HealthData } from "../data/use-health";
import { fmtDuration, fmtNum, signed } from "../format";
import { correlate } from "../insights/insights";
import { ScoreResult } from "../types";

/**
 * The assistant answers questions using ONLY the user's local data — scores,
 * contributors, insights and logs. Deterministic and on-device: no external
 * AI service, no data leaves the browser. Answers show their reasoning and
 * use observational language.
 */

export interface AssistantReply {
  text: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function explainScore(name: string, s: ScoreResult): string {
  const ups = s.contributors.filter((c) => c.points > 0).slice(0, 3);
  const downs = s.contributors.filter((c) => c.points < 0).slice(0, 3);
  const fmtSide = (list: typeof ups) => list.map((c) => `${c.label} (${signed(c.points)})`).join(", ");
  let t = `Your ${name} is ${s.scale === 21 ? s.score.toFixed(1) : Math.round(s.score)}${s.scale === 100 ? "" : "/21"} — ${s.status.toLowerCase()}, ${s.deltaVsYesterday >= 0 ? "up" : "down"} ${Math.abs(Math.round(s.deltaVsYesterday * 10) / 10)} vs yesterday.\n\n${s.explanation}`;
  if (ups.length) t += `\n\nHelping: ${fmtSide(ups)}.`;
  if (downs.length) t += `\nHurting: ${fmtSide(downs)}.`;
  return t;
}

export function answer(q: string, d: HealthData): AssistantReply {
  const lower = q.toLowerCase();
  const t = d.today;

  if (!d.connected || !t) {
    if (/(food|eat|calorie|protein|nutrition)/.test(lower)) {
      return {
        text: `You've logged ${fmtNum(d.todayTotals.kcal)} kcal today (${d.todayTotals.protein}g protein, ${d.todayTotals.carbs}g carbs, ${d.todayTotals.fat}g fat) against a ${fmtNum(d.goals.find((g) => g.kind === "calories")?.target ?? 2400)} kcal goal. Connect your Fitbit in Settings and I can also answer questions about sleep, recovery, energy and strain.`,
      };
    }
    return {
      text: "I answer from your own data, and there's no wearable data yet. Connect your Fitbit in Settings → sync, and ask me things like “why is my recovery low?”, “how did I sleep this week?” or “what affects my sleep?”. Nutrition, journal and medication questions work as soon as you log entries.",
    };
  }

  // why / explain a score
  if (/(recovery)/.test(lower) && /(why|low|high|explain|what)/.test(lower)) return { text: explainScore("recovery", t.recovery) };
  if (/(energy|battery)/.test(lower)) return { text: explainScore("energy", t.energy) };
  if (/(strain|load|training)/.test(lower) && !/sleep/.test(lower)) return { text: explainScore("strain", t.strain) };
  if (/sleep/.test(lower) && /(week|trend|lately|average)/.test(lower)) {
    const week = d.days.slice(-7);
    const avg = mean(week.map((s) => s.day.sleep.asleepMin).filter((v) => v > 0));
    const best = [...week].sort((a, b) => b.sleep.score - a.sleep.score)[0];
    const worst = [...week].sort((a, b) => a.sleep.score - b.sleep.score)[0];
    return {
      text: `Over the last ${week.length} nights you averaged ${fmtDuration(avg)} of sleep. Best night: ${best.day.date} (score ${best.sleep.score}); toughest: ${worst.day.date} (score ${worst.sleep.score}). Your sleep debt currently stands at ${fmtDuration(t.day.sleep.debtMin)}.${avg < 450 ? " You're running under your ~8h need — the single highest-leverage fix in your data." : ""}`,
    };
  }
  if (/sleep/.test(lower)) return { text: explainScore("sleep", t.sleep) };

  // what affects X
  if (/(affect|correlat|pattern|associat|influence)/.test(lower)) {
    if (!d.insights.length)
      return { text: `No solid patterns yet — associations need repeated logs (about two weeks of journal + wearable data). Keep tagging behaviors in the Journal and I'll surface things like "smoking was associated with lower HRV" with sample sizes.` };
    const top = d.insights.slice(0, 4).map((i) => `• ${i.title} — ${i.detail.split(". ")[0]}. (n=${i.n})`);
    return { text: `Strongest observed associations in your data so far:\n\n${top.join("\n")}\n\nThese are correlations in your logs, not proof of cause.` };
  }

  // nutrition
  if (/(food|eat|calorie|protein|macro|nutrition)/.test(lower)) {
    const goal = d.goals.find((g) => g.kind === "calories")?.target ?? 2400;
    const protein = d.goals.find((g) => g.kind === "protein")?.target ?? 150;
    return {
      text: `Today: ${fmtNum(d.todayTotals.kcal)} of ${fmtNum(goal)} kcal (${fmtNum(Math.max(0, goal - d.todayTotals.kcal))} left) · protein ${d.todayTotals.protein}/${protein}g · carbs ${d.todayTotals.carbs}g · fat ${d.todayTotals.fat}g. You've burned roughly ${fmtNum(t.day.activeCalories + t.day.restingCalories)} kcal.${d.todayTotals.protein < protein * 0.5 ? " Protein is the biggest gap right now." : ""}`,
    };
  }

  // meds
  if (/(med|pill|dose|adherence)/.test(lower)) {
    const evts = d.todayMedEvents;
    if (!evts.length) return { text: "No medications set up yet — add them on the Medication page and I can track adherence and surface observational associations with your sleep and recovery." };
    const taken = evts.filter((e) => e.status === "taken").length;
    return { text: `Today: ${taken} of ${evts.length} scheduled doses logged as taken. I only ever report observational associations for medication — never advice about changing it.` };
  }

  // hrv / rhr
  if (/hrv/.test(lower)) {
    const c = correlate(d.days, "sleepMin", "hrv", 0);
    return {
      text: `Overnight HRV is ${t.day.hrv.rmssdMs} ms vs your ${Math.round(t.baseline.hrvMs)} ms baseline (${signed(t.day.hrv.rmssdMs - t.baseline.hrvMs)}).${c ? ` Across ${c.n} days, sleep duration and HRV correlate at r = ${fmtNum(c.r, 2)} in your data.` : ""} Higher-than-baseline HRV generally reads as better recovery capacity.`,
    };
  }
  if (/(resting|rhr|heart rate)/.test(lower)) {
    return {
      text: `Resting HR is ${t.day.rhr.bpm} bpm vs your ${Math.round(t.baseline.rhrBpm)} bpm baseline (${signed(t.day.rhr.bpm - t.baseline.rhrBpm)} — ${t.day.rhr.bpm <= t.baseline.rhrBpm ? "a good sign" : "slightly elevated; alcohol, late meals, illness or hard training are common causes"}).`,
    };
  }

  // today / general
  if (/(today|how am i|doing|summary|morning)/.test(lower)) {
    return {
      text: `${explainScore("energy", t.energy)}\n\nRecovery ${t.recovery.score}% · Sleep ${fmtDuration(t.day.sleep.asleepMin)} (score ${t.sleep.score}) · Strain ${t.strain.score.toFixed(1)} · ${fmtNum(t.day.steps)} steps.`,
    };
  }

  return {
    text: `I can explain any score ("why is my recovery ${t.recovery.score}?"), summarize sleep ("how did I sleep this week?"), report what appears to affect you ("what affects my sleep?"), and answer nutrition, HRV, resting-HR and medication questions — all from your own data, on-device.`,
  };
}

export const SUGGESTIONS = [
  "How am I doing today?",
  "Why is my recovery where it is?",
  "How did I sleep this week?",
  "What affects me the most?",
  "How's my nutrition today?",
  "Is my resting heart rate okay?",
];
