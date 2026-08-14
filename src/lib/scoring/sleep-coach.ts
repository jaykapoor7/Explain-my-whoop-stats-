import { DailySummary } from "../types";
import { clamp } from "../format";

/**
 * Sleep coach — WHOOP-style sleep need, sleep debt and a recommended bedtime.
 *
 * Everything is derived from the user's own recent nights, so it adapts to how
 * much sleep THIS person actually needs and when they tend to wake. Deliberate,
 * transparent heuristics (not a clinical model): a baseline need, a rolling
 * debt that surplus nights pay down, a small strain top-up, and a bedtime
 * back-calculated from the habitual wake time and personal sleep efficiency.
 */

const DEFAULT_NEED = 480; // 8h physiological default before we know the user

const median = (xs: number[]): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const minutesInto = (iso: string): number => {
  const hm = iso.slice(11, 16);
  const [h, m] = hm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

const fmtHM = (mins: number): string => {
  const t = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** Personal baseline need — what you get on your fuller nights (70th pct),
 * bounded to a healthy range. Falls back to 8h with little data. */
export function personalSleepNeed(history: DailySummary[]): number {
  const asleep = history.map((d) => d.sleep.asleepMin).filter((m) => m > 0);
  if (asleep.length < 5) return DEFAULT_NEED;
  const s = [...asleep].sort((a, b) => a - b);
  const p70 = s[Math.min(s.length - 1, Math.floor(s.length * 0.7))];
  return Math.round(clamp(p70, 420, 540));
}

/** Rolling sleep debt as of the last night: shortfalls over the last 5 nights,
 * with surplus nights repaying it at half weight. Capped at 5h. */
export function sleepDebtMin(history: DailySummary[], needMin: number): number {
  const recent = history.slice(-5).map((d) => d.sleep.asleepMin).filter((m) => m > 0);
  let debt = 0;
  for (const a of recent) {
    const gap = needMin - a; // + = short, - = surplus
    debt += gap > 0 ? gap : gap * 0.5;
    if (debt < 0) debt = 0;
  }
  return Math.round(clamp(debt, 0, 300));
}

export interface SleepCoach {
  available: boolean;
  baselineNeedMin: number;
  debtMin: number;
  strainAddMin: number;
  tonightNeedMin: number;
  suggestedBedtime: string; // local HH:MM
  suggestedWake: string;    // local HH:MM
  efficiencyPct: number;
  rationale: string;
}

/** Tonight's recommendation, built from the day history (chronological). */
export function sleepCoach(history: DailySummary[]): SleepCoach {
  const nights = history.filter((d) => d.sleep.asleepMin > 0);
  const need = personalSleepNeed(history);
  const debt = sleepDebtMin(history, need);

  // Yesterday's activity nudges tonight's need up a little.
  const last = history[history.length - 1];
  const steps = last?.steps ?? 0;
  const strainAdd = clamp(Math.round((steps - 8000) / 1000) * 4, 0, 30);

  const repay = Math.min(debt, 90); // pay down up to 1.5h tonight
  const tonightNeed = need + repay + strainAdd;

  // Habitual wake time + personal efficiency from the last two weeks.
  const wakeMins = history.slice(-14).map((d) => minutesInto(d.sleep.wake)).filter((m) => isFinite(m));
  const wakeMin = wakeMins.length ? median(wakeMins) : 7 * 60;
  const effs = history.slice(-14).map((d) => d.sleep.efficiencyPct).filter((e) => e > 0);
  const eff = effs.length ? clamp(median(effs), 75, 96) : 90;

  const timeInBed = tonightNeed / (eff / 100);
  const onset = 15; // typical time to fall asleep
  const bedMin = wakeMin - timeInBed - onset;

  const debtH = debt >= 60 ? `${(debt / 60).toFixed(1)}h` : `${debt}m`;
  const rationale = nights.length < 5
    ? `Based on an 8h target for now — a few more nights and CURA will tune this to your own need.`
    : `Your body runs on about ${(need / 60).toFixed(1)}h. ${debt >= 45 ? `You're carrying ${debtH} of sleep debt, so tonight's target is bumped up to pay some back.` : `You're on top of your sleep debt.`}${strainAdd >= 8 ? " Yesterday was active, so a touch more is added." : ""}`;

  return {
    available: nights.length >= 3,
    baselineNeedMin: need,
    debtMin: debt,
    strainAddMin: strainAdd,
    tonightNeedMin: Math.round(tonightNeed),
    suggestedBedtime: fmtHM(bedMin),
    suggestedWake: fmtHM(wakeMin),
    efficiencyPct: Math.round(eff),
    rationale,
  };
}
