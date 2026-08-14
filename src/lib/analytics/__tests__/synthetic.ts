import type { DailySummary } from "../../types";

/**
 * Synthetic longitudinal users for evaluating the analytics engine. Seeded RNG
 * so runs are deterministic. Each generator returns a realistic DailySummary[]
 * exercising a specific scenario the model must handle correctly.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dateFor = (i: number, total: number): string => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (total - 1 - i));
  return d.toISOString().slice(0, 10);
};

export interface DayParams {
  hrv: number | null;
  rhr: number | null;
  asleepMin: number | null;
  efficiencyPct?: number;
  consistencyPct?: number;
  deep?: number;
  rem?: number;
  steps?: number;
  bedtimeHour?: number;
}

export function mkDay(date: string, p: DayParams): DailySummary {
  const asleep = p.asleepMin ?? 0;
  const deep = p.deep ?? Math.round(asleep * 0.18);
  const rem = p.rem ?? Math.round(asleep * 0.21);
  const light = Math.max(0, asleep - deep - rem);
  const bt = p.bedtimeHour ?? 23;
  return {
    date,
    hrv: { date, rmssdMs: p.hrv ?? 0 },
    rhr: { date, bpm: p.rhr ?? 0 },
    sleep: {
      date,
      bedtime: `${date}T${String(bt).padStart(2, "0")}:00:00`,
      wake: `${date}T07:00:00`,
      inBedMin: asleep ? Math.round(asleep / ((p.efficiencyPct ?? 90) / 100)) : 0,
      asleepMin: asleep,
      efficiencyPct: asleep ? p.efficiencyPct ?? 90 : 0,
      stages: { awake: Math.max(0, Math.round(asleep * 0.06)), light, deep, rem },
      awakenings: 0,
      sleepHrBpm: p.rhr ? p.rhr + 3 : 0,
      overnightHrvMs: p.hrv ?? 0,
      consistencyPct: p.consistencyPct ?? 0,
      debtMin: 0,
      needMin: 480,
    },
    activities: [],
    steps: p.steps ?? 0,
    activeCalories: p.steps ? Math.round(p.steps * 0.04) : 0,
    restingCalories: 1500,
    meals: [],
    medicationEvents: [],
  };
}

const gauss = (rnd: () => number, mean: number, sd: number) => {
  const u = 1 - rnd(), v = rnd();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

interface GenOpts { days?: number; seed?: number }

/** 1. Stable healthy baseline. */
export function stableHealthy({ days = 90, seed = 1 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => mkDay(dateFor(i, days), {
    hrv: Math.round(gauss(r, 65, 4)), rhr: Math.round(gauss(r, 52, 2)),
    asleepMin: Math.round(gauss(r, 450, 22)), efficiencyPct: 91, consistencyPct: 85,
    steps: Math.round(gauss(r, 8500, 1500)), bedtimeHour: 23,
  }));
}

/** 2. Chronically low (but stable) HRV — normal FOR THIS USER. */
export function chronicLowHrv({ days = 90, seed = 2 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => mkDay(dateFor(i, days), {
    hrv: Math.round(gauss(r, 40, 3)), rhr: Math.round(gauss(r, 58, 2)),
    asleepMin: Math.round(gauss(r, 440, 22)), efficiencyPct: 89, consistencyPct: 80, steps: Math.round(gauss(r, 7000, 1400)),
  }));
}

/** 3. Stable, then a sudden recovery crash in the last few days. */
export function recoveryCrash({ days = 90, seed = 3 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => {
    const crash = i >= days - 4;
    return mkDay(dateFor(i, days), {
      hrv: Math.round(crash ? gauss(r, 44, 2) : gauss(r, 66, 4)),
      rhr: Math.round(crash ? gauss(r, 61, 2) : gauss(r, 52, 2)),
      asleepMin: Math.round(crash ? gauss(r, 380, 20) : gauss(r, 450, 20)),
      efficiencyPct: crash ? 82 : 91, consistencyPct: 84, steps: Math.round(gauss(r, 8000, 1500)),
    });
  });
}

/** 4. Gradual improvement over the window. */
export function gradualImprovement({ days = 90, seed = 4 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => {
    const t = i / (days - 1);
    return mkDay(dateFor(i, days), {
      hrv: Math.round(gauss(r, 46 + t * 20, 4)), rhr: Math.round(gauss(r, 60 - t * 8, 2)),
      asleepMin: Math.round(gauss(r, 420 + t * 40, 20)), efficiencyPct: 90, consistencyPct: 82,
      steps: Math.round(gauss(r, 7000 + t * 2000, 1400)),
    });
  });
}

/** 5. Gradual deterioration. */
export function gradualDeterioration({ days = 90, seed = 5 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => {
    const t = i / (days - 1);
    return mkDay(dateFor(i, days), {
      hrv: Math.round(gauss(r, 66 - t * 18, 4)), rhr: Math.round(gauss(r, 52 + t * 7, 2)),
      asleepMin: Math.round(gauss(r, 460 - t * 40, 20)), efficiencyPct: 90, consistencyPct: 80,
      steps: Math.round(gauss(r, 8500 - t * 1500, 1400)),
    });
  });
}

/** 6. Highly variable / noisy with missing days. */
export function noisyMissing({ days = 90, seed = 6 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => {
    const worn = r() > 0.45; // device off >half the time
    return mkDay(dateFor(i, days), {
      hrv: worn ? Math.round(gauss(r, 58, 14)) : null,
      rhr: worn ? Math.round(gauss(r, 56, 6)) : null,
      asleepMin: worn ? Math.round(gauss(r, 430, 60)) : null,
      efficiencyPct: 88, consistencyPct: 60, steps: worn ? Math.round(gauss(r, 7000, 3000)) : 0,
    });
  });
}

/** 7. Brand-new user: only a handful of days. */
export function newUser({ days = 4, seed = 7 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => mkDay(dateFor(i, days), {
    hrv: Math.round(gauss(r, 60, 5)), rhr: Math.round(gauss(r, 55, 3)), asleepMin: Math.round(gauss(r, 440, 25)), steps: 8000,
  }));
}

/** 8. Device switch mid-history → baseline steps up (drift). */
export function deviceSwitch({ days = 90, seed = 8 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => {
    const second = i >= days / 2;
    return mkDay(dateFor(i, days), {
      hrv: Math.round(gauss(r, second ? 74 : 60, 4)), // new device reads HRV higher
      rhr: Math.round(gauss(r, 54, 2)), asleepMin: Math.round(gauss(r, 445, 20)), efficiencyPct: 90, steps: 8000,
    });
  });
}

/** 9. Conflicting signals: low HRV but great sleep + normal RHR. */
export function conflicting({ days = 60, seed = 9 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => {
    const last = i === days - 1;
    return mkDay(dateFor(i, days), {
      hrv: Math.round(last ? gauss(r, 44, 2) : gauss(r, 64, 4)), // only HRV dips today
      rhr: Math.round(gauss(r, 53, 2)), asleepMin: Math.round(gauss(r, last ? 470 : 450, 18)),
      efficiencyPct: 93, consistencyPct: 88, steps: 8000,
    });
  });
}

/** 10. Strong intervention: earlier bedtime nights lift next-day HRV. */
export function strongIntervention({ days = 80, seed = 10 }: GenOpts = {}): DailySummary[] {
  const r = mulberry32(seed);
  const early: boolean[] = Array.from({ length: days }, () => r() > 0.5);
  return Array.from({ length: days }, (_, i) => {
    const prevEarly = i > 0 && early[i - 1];
    return mkDay(dateFor(i, days), {
      hrv: Math.round(gauss(r, prevEarly ? 70 : 58, 3)), // earlier bed → higher HRV next day
      rhr: Math.round(gauss(r, prevEarly ? 51 : 55, 2)),
      asleepMin: Math.round(gauss(r, early[i] ? 470 : 410, 18)),
      efficiencyPct: 90, consistencyPct: 75, steps: 8000, bedtimeHour: early[i] ? 22 : 23,
    });
  });
}
