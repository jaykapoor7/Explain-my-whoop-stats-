import { Activity, DailySummary } from "../types";
import { estimateActivityLoad } from "../scoring/strain";

/**
 * Build a full DailySummary from numbers a user typed in by hand — so ANY
 * wearable (Apple Watch, Garmin, Oura, Whoop, Samsung…) or even no device at
 * all can feed CURA. Fields left blank stay 0, which the scoring engine treats
 * as "not measured" (never a fake reading). Sleep stages are estimated from
 * total sleep so the sleep score is reasonable.
 */
export interface ManualInput {
  date: string;
  sleepH?: number;   // hours asleep
  bedtime?: string;  // "HH:MM"
  wake?: string;     // "HH:MM"
  rhr?: number;      // resting heart rate
  hrv?: number;      // overnight HRV (rMSSD, ms)
  steps?: number;
  workout?: { type: string; minutes: number; avgHr?: number };
}

const n = (v: number | undefined) => (typeof v === "number" && isFinite(v) && v > 0 ? v : 0);

export function manualDay(input: ManualInput): DailySummary {
  const date = input.date;
  const asleepMin = Math.round(n(input.sleepH) * 60);
  const inBedMin = asleepMin ? Math.round(asleepMin / 0.92) : 0;
  const efficiencyPct = asleepMin ? 92 : 0;
  // Typical adult stage split, used only when the user didn't give stages.
  const deep = Math.round(asleepMin * 0.18);
  const rem = Math.round(asleepMin * 0.21);
  const awake = Math.max(0, inBedMin - asleepMin);
  const light = Math.max(0, asleepMin - deep - rem);
  const hrv = n(input.hrv);
  const rhr = n(input.rhr);
  const steps = n(input.steps);

  const activities: Activity[] = [];
  const w = input.workout;
  if (w && n(w.minutes) > 0) {
    const avgHr = Math.round(n(w.avgHr));
    activities.push({
      id: `manual-${date}-${w.type}`,
      date,
      type: w.type || "Workout",
      start: `${date}T18:00:00`,
      durationMin: Math.round(w.minutes),
      avgHr,
      maxHr: 0,
      calories: Math.round(w.minutes * (avgHr > 120 ? 9 : 6)),
      zones: [0, 0, 0, 0, 0],
      load: estimateActivityLoad(w.minutes, avgHr),
      confidence: "high",
    });
  }

  // Rough calorie estimate so Energy/nutrition have something to work with.
  const activeCalories = Math.round(steps * 0.04 + activities.reduce((a, x) => a + x.calories, 0));

  return {
    date,
    hrv: { date, rmssdMs: hrv },
    rhr: { date, bpm: rhr },
    sleep: {
      date,
      bedtime: `${date}T${input.bedtime || "23:00"}:00`,
      wake: `${date}T${input.wake || "07:00"}:00`,
      inBedMin,
      asleepMin,
      efficiencyPct,
      stages: { awake, light, deep, rem },
      awakenings: 0,
      sleepHrBpm: 0,
      overnightHrvMs: hrv,
      consistencyPct: 0,
      debtMin: 0,
      needMin: 480,
    },
    activities,
    steps,
    activeCalories,
    restingCalories: 1500,
    meals: [],
    medicationEvents: [],
  };
}
