import type { Activity, ActivityConfidence, SleepSession } from "../types";

/**
 * Pure mappers from Google Health API dataPoints → Health OS domain objects.
 * Field shapes verified against real Fitbit-sourced responses. Each point
 * wraps its payload under a camelCase key matching the data type
 * (e.g. `dailyRestingHeartRate`, `sleep`, `exercise`).
 *
 * Kept free of `server-only` and network code so it can be unit-tested.
 */

// eslint-disable-next-line
type Json = Record<string, any>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function numOf(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (isFinite(n)) return n;
  }
  return undefined;
}

/** Google durations/offsets look like "-14400s" or "1200s". */
function secondsOf(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.match(/^(-?\d+(?:\.\d+)?)s?$/);
    if (m) return parseFloat(m[1]);
  }
  return undefined;
}

/** UTC ISO + a UTC offset → local wall-clock ISO (no Z), so slice(11,16) reads local HH:MM. */
function localIso(utc: string, offset: unknown): string {
  const ms = Date.parse(utc);
  if (!isFinite(ms)) return utc;
  const off = secondsOf(offset) ?? 0;
  return new Date(ms + off * 1000).toISOString().slice(0, 19);
}

function civilDate(d: Json | undefined): string | undefined {
  if (!d || typeof d !== "object") return undefined;
  const y = numOf(d.year), m = numOf(d.month), day = numOf(d.day);
  if (y && m && day) return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return undefined;
}

function humanize(s: string): string {
  return s.replace(/[_-]+/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function mapRhr(p: Json): { date: string; bpm: number } | null {
  const r = p?.dailyRestingHeartRate;
  const date = civilDate(r?.date);
  const bpm = numOf(r?.beatsPerMinute);
  if (!date || !bpm) return null;
  return { date, bpm: Math.round(bpm) };
}

export function mapHrv(p: Json): { date: string; rmssdMs: number; nonRemHrBpm?: number } | null {
  const h = p?.dailyHeartRateVariability;
  const date = civilDate(h?.date);
  const ms = numOf(h?.averageHeartRateVariabilityMilliseconds) ?? numOf(h?.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds);
  if (!date || ms === undefined) return null;
  const nonRem = numOf(h?.nonRemHeartRateBeatsPerMinute);
  return { date, rmssdMs: Math.round(ms), nonRemHrBpm: nonRem !== undefined ? Math.round(nonRem) : undefined };
}

export function mapWeight(p: Json): { date: string; kg: number } | null {
  const w = p?.weight;
  const grams = numOf(w?.weightGrams);
  const date =
    civilDate(w?.sampleTime?.civilTime?.date) ??
    (typeof w?.sampleTime?.physicalTime === "string" ? w.sampleTime.physicalTime.slice(0, 10) : undefined);
  if (!date || grams === undefined) return null;
  return { date, kg: Math.round((grams / 1000) * 10) / 10 };
}

const STAGE_MAP: Record<string, "awake" | "light" | "deep" | "rem"> = {
  AWAKE: "awake", WAKE: "awake", LIGHT: "light", DEEP: "deep", REM: "rem",
};

/** Returns the sleep session plus whether Fitbit flagged it the main sleep. */
export function mapSleep(p: Json): (SleepSession & { mainSleep: boolean }) | null {
  const s = p?.sleep;
  if (!s) return null;
  const iv = s.interval ?? {};
  const startUtc: string | undefined = iv.startTime;
  const endUtc: string | undefined = iv.endTime;
  if (!startUtc && !endUtc) return null;
  const bedtime = startUtc ? localIso(startUtc, iv.startUtcOffset) : "";
  const wake = endUtc ? localIso(endUtc, iv.endUtcOffset) : "";
  const date = (wake || bedtime).slice(0, 10);
  if (!date) return null;

  const stages = { awake: 0, light: 0, deep: 0, rem: 0 };
  const summaryStages: Json[] = Array.isArray(s.summary?.stagesSummary) ? s.summary.stagesSummary : [];
  for (const ss of summaryStages) {
    const k = STAGE_MAP[String(ss.type).toUpperCase()];
    const mins = numOf(ss.minutes);
    if (k && mins !== undefined) stages[k] += Math.round(mins);
  }

  const asleepMin = numOf(s.summary?.minutesAsleep) ?? stages.light + stages.deep + stages.rem;
  if (!asleepMin) return null;
  const awakeMin = numOf(s.summary?.minutesAwake) ?? stages.awake;
  const inBedMin = numOf(s.summary?.minutesInSleepPeriod) ?? asleepMin + awakeMin;
  if (!stages.awake && awakeMin) stages.awake = Math.round(awakeMin);

  const awakenings = Array.isArray(s.shortAwakenings)
    ? s.shortAwakenings.length
    : Math.round(numOf(summaryStages.find((x) => String(x.type).toUpperCase() === "AWAKE")?.count) ?? 0);

  return {
    date,
    bedtime: bedtime || `${date}T23:30:00`,
    wake: wake || `${date}T07:00:00`,
    inBedMin: Math.round(inBedMin),
    asleepMin: Math.round(asleepMin),
    efficiencyPct: inBedMin ? Math.round(clamp((asleepMin / inBedMin) * 100, 40, 99)) : 0,
    stages,
    awakenings,
    sleepHrBpm: 0,
    overnightHrvMs: 0,
    consistencyPct: 0,
    debtMin: 0,
    needMin: 480,
    mainSleep: s.metadata?.mainSleep !== false,
  };
}

export function mapExercise(p: Json): Activity | null {
  const e = p?.exercise;
  if (!e) return null;
  const iv = e.interval ?? {};
  const startUtc: string | undefined = iv.startTime;
  const start = startUtc ? localIso(startUtc, iv.startUtcOffset) : "";
  const date = (start || (iv.endTime ? localIso(iv.endTime, iv.endUtcOffset) : "")).slice(0, 10);
  if (!date) return null;

  let durMin = 0;
  const active = secondsOf(e.activeDuration);
  if (active !== undefined) durMin = Math.round(active / 60);
  else if (startUtc && iv.endTime) durMin = Math.round((Date.parse(iv.endTime) - Date.parse(startUtc)) / 60000);
  if (durMin <= 0) return null;

  const m = e.metricsSummary ?? {};
  const avgHr = Math.round(numOf(m.averageHeartRateBeatsPerMinute) ?? 0);
  const kcal = Math.round(numOf(m.caloriesKcal) ?? 0);
  const method = String(p.dataSource?.recordingMethod ?? "").toUpperCase();
  const auto = method.includes("AUTO") || method.includes("DERIVED");
  const confidence: ActivityConfidence = auto && durMin < 15 ? "low" : auto ? "medium" : "high";

  const z = m.heartRateZoneDurations ?? {};
  const zmin = (v: unknown) => Math.round((secondsOf(v) ?? 0) / 60);
  const zones = [0, zmin(z.lightTime), zmin(z.moderateTime), zmin(z.vigorousTime), zmin(z.peakTime)];

  const name = e.displayName || humanize(String(e.exerciseType ?? "Workout"));
  const load = clamp(durMin * 0.06 + (avgHr > 0 ? Math.max(0, avgHr - 100) * 0.045 : 2), 0.3, 19);
  const id = p.name ? String(p.name).split("/").pop() : `${date}-${start}`;

  return {
    id: `gh-${id}`,
    date,
    type: auto && durMin < 15 ? "Unrecognized elevated HR" : name,
    start: start || `${date}T12:00:00`,
    durationMin: durMin,
    avgHr,
    maxHr: 0,
    calories: kcal,
    zones,
    load: Math.round(load * 10) / 10,
    confidence,
  };
}

/** Date of a dailyRollUp point: civilStartTime.date (else civilEndTime.date). */
function rollupDate(p: Json): string | undefined {
  return civilDate(p?.civilStartTime?.date) ?? civilDate(p?.civilEndTime?.date) ?? civilDate(p?.date);
}

/** Daily step rollup point → { date, steps }. Verified: steps.countSum. */
export function mapStepsRollup(p: Json): { date: string; steps: number } | null {
  const w = p?.steps ?? p;
  const date = rollupDate(p);
  const steps = numOf(w?.countSum) ?? numOf(w?.count) ?? numOf(w?.steps) ?? numOf(w?.total) ?? numOf(w?.value);
  if (!date || steps === undefined) return null;
  return { date, steps: Math.round(steps) };
}

/** Daily total-calories rollup point → { date, kcal }. Verified: totalCalories.kcalSum. */
export function mapCaloriesRollup(p: Json): { date: string; kcal: number } | null {
  const w = p?.totalCalories ?? p;
  const date = rollupDate(p);
  const kcal =
    numOf(w?.kcalSum) ?? numOf(w?.energyKcal) ?? numOf(w?.caloriesKcal) ?? numOf(w?.kilocalories) ??
    numOf(w?.calories) ?? numOf(w?.value);
  if (!date || kcal === undefined) return null;
  return { date, kcal: Math.round(kcal) };
}
