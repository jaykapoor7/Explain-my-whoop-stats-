import {
  Activity,
  DailySummary,
  Dataset,
  Goal,
  JournalEntry,
  Meal,
  Medication,
  MedicationEvent,
  PlannerTask,
  SleepSession,
} from "../types";
import { addDays, todayISO } from "../format";
import { food } from "./foods";

/** Seeded deterministic RNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

const MEDICATIONS: Medication[] = [
  { id: "med-d3", name: "Vitamin D3", dose: "2000 IU", frequency: "once", times: ["08:00"], withFood: "with", startDate: "2020-01-01", notes: "Morning with breakfast." },
  { id: "med-mag", name: "Magnesium glycinate", dose: "400 mg", frequency: "once", times: ["21:30"], withFood: "either", startDate: "2020-01-01", notes: "Before bed." },
  { id: "med-inhaler", name: "Inhaler", dose: "2 puffs", frequency: "as-needed", times: [], withFood: "either", startDate: "2020-01-01", notes: "As needed before football." },
];

const GOALS: Goal[] = [
  { id: "g-weight", kind: "weight", label: "Reach 76 kg", target: 76, unit: "kg", direction: "hit" },
  { id: "g-cal", kind: "calories", label: "Daily calories", target: 2400, unit: "kcal", direction: "at-most", domain: "nutrition" },
  { id: "g-protein", kind: "protein", label: "Protein", target: 150, unit: "g", direction: "at-least", domain: "nutrition" },
  { id: "g-sleep", kind: "sleep", label: "Sleep", target: 480, unit: "min", direction: "at-least", domain: "sleep" },
  { id: "g-steps", kind: "steps", label: "Steps", target: 10000, unit: "steps", direction: "at-least", domain: "strain" },
  { id: "g-train", kind: "training", label: "Train 4× / week", target: 4, unit: "sessions", direction: "at-least", domain: "strain" },
  { id: "g-study", kind: "academic", label: "Study 12h / week", target: 12, unit: "hours", direction: "at-least" },
];

function buildMeals(date: ISODateSeed, rand: () => number, indulgent: boolean, drank: boolean): Meal[] {
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const meals: Meal[] = [
    { id: `${date}-b`, date, kind: "breakfast", time: "08:15", items: [
      { food: food("f-oats"), servings: 1 },
      { food: food(pick(["f-eggs", "f-yogurt", "f-banana"])), servings: 1 },
      { food: food("f-coffee"), servings: 1 },
    ] },
    { id: `${date}-l`, date, kind: "lunch", time: "13:00", items: [
      { food: food(pick(["f-chicken", "f-salad", "f-tuna", "f-burrito"])), servings: 1 },
      { food: food(pick(["f-rice", "f-toast", "f-apple"])), servings: 1 },
    ] },
    { id: `${date}-d`, date, kind: "dinner", time: "19:45", items: indulgent
      ? [{ food: food(pick(["f-pizza", "f-burrito", "f-steak"])), servings: 1 }, { food: food("f-fries"), servings: 1 }]
      : [{ food: food(pick(["f-salmon", "f-chicken", "f-pasta"])), servings: 1 }, { food: food("f-broccoli"), servings: 1 }, { food: food("f-rice"), servings: 1 }] },
    { id: `${date}-s`, date, kind: "snack", time: "16:30", items: [{ food: food(pick(["f-almonds", "f-apple", "f-shake", "f-choc"])), servings: 1 }] },
  ];
  if (drank) meals[2].items.push({ food: food("f-beer"), servings: Math.round(1 + rand() * 3) });
  return meals;
}

type ISODateSeed = string;

export function generateDataset(): Dataset {
  const rand = rng(20260214);
  const gauss = () => {
    const u = Math.max(1e-9, rand());
    const v = Math.max(1e-9, rand());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const N = 90;
  const end = todayISO();
  const days: DailySummary[] = [];

  let sleepDebt = 60;
  let prevStrain = 10;
  let fitness = 0;
  let prevFootball = false;

  for (let i = N - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const dow = new Date(date + "T12:00:00").getDay();
    const isWeekend = dow === 0 || dow === 6;
    const idx = N - 1 - i;
    fitness = idx * 0.02;

    // --- lifestyle drivers (also surfaced in journal) ---
    const smokes = rand() < 0.72;
    const cigarettes = smokes ? Math.round(clamp(gauss() * 2 + 5, 1, 14)) : 0;
    const drank = (isWeekend && rand() < 0.6) || rand() < 0.12;
    const caffeineCups = Math.round(clamp(1 + rand() * 3, 0, 5));
    const lateCaffeine = caffeineCups >= 3 && rand() < 0.4;

    // --- sleep (driven by yesterday's football, alcohol, weekend) ---
    const lateNight = drank || (isWeekend && rand() < 0.4);
    const bedH = clamp(22.6 + gauss() * 0.6 + (lateNight ? 1.5 : 0) + (lateCaffeine ? 0.4 : 0), 21, 27.5);
    const needMin = clamp(470 + prevStrain * 3 + sleepDebt * 0.1, 450, 560);
    let asleepMin =
      430 + gauss() * 35 + (prevFootball ? 40 : 0) + (isWeekend ? 25 : 0) - (bedH > 24 ? 55 : 0) - (drank ? 35 : 0);
    asleepMin = clamp(asleepMin, 250, 560);
    const inBedMin = asleepMin + clamp(25 + (100 - asleepMin / 6) + gauss() * 12, 15, 90);
    const efficiencyPct = clamp((asleepMin / inBedMin) * 100 - (drank ? 3 : 0) - (lateCaffeine ? 2 : 0), 70, 97);
    const deep = clamp(asleepMin * (0.19 + gauss() * 0.02 - (drank ? 0.03 : 0)), 40, 140);
    const rem = clamp(asleepMin * (0.23 + gauss() * 0.02 - (drank ? 0.03 : 0) - (lateCaffeine ? 0.02 : 0)), 45, 160);
    const awake = clamp(inBedMin - asleepMin - 5 + gauss() * 6, 8, 80);
    const light = clamp(asleepMin - deep - rem, 60, 320);
    const awakenings = Math.round(clamp(2 + gauss() + (drank ? 2 : 0), 0, 9));
    const sleepHr = Math.round(clamp(56 + gauss() * 3 + (drank ? 5 : 0) - fitness, 48, 74));
    const consistency = Math.round(clamp(84 - Math.abs(bedH - 22.9) * 6 + gauss() * 4 - (isWeekend ? 6 : 0), 40, 98));
    sleepDebt = clamp(sleepDebt + (needMin - asleepMin) * 0.5, 0, 320);

    const wakeH = (bedH - 24 + (inBedMin / 60) + 24) % 24;
    const bedtime = `${date}T${String(Math.floor(bedH % 24)).padStart(2, "0")}:${String(Math.floor((bedH % 1) * 60)).padStart(2, "0")}:00`;
    const wakeDate = bedH >= 24 || wakeH < bedH ? date : date;
    const wake = `${wakeDate}T${String(Math.floor(wakeH)).padStart(2, "0")}:${String(Math.floor((wakeH % 1) * 60)).padStart(2, "0")}:00`;

    // --- physiology ---
    const sleepBoost = (asleepMin - 450) / 12;
    const hrv = Math.round(
      clamp(
        62 + fitness * 2.5 + sleepBoost - cigarettes * 0.8 - (drank ? 6 : 0) - (prevFootball ? 5 : 0) + gauss() * 5,
        24,
        120
      )
    );
    const rhr = Math.round(
      clamp(55 - fitness * 0.6 - sleepBoost * 0.25 + cigarettes * 0.15 + (drank ? 2.5 : 0) + (prevFootball ? 1.5 : 0) + gauss() * 1.6, 44, 72)
    );

    // --- activities ---
    const activities: Activity[] = [];
    let id = 0;
    const mkId = () => `${date}-a${id++}`;
    // daily walking
    const walkMin = Math.round(clamp(35 + gauss() * 15 + (isWeekend ? 20 : 0), 10, 90));
    activities.push({
      id: mkId(), date, type: "Walking", start: `${date}T12:30:00`, durationMin: walkMin,
      avgHr: Math.round(96 + gauss() * 6), maxHr: Math.round(118 + gauss() * 8),
      calories: Math.round(walkMin * 4.2), zones: [walkMin - 6, 6, 0, 0, 0].map((z) => Math.max(0, z)),
      load: r1(clamp(walkMin / 22, 0.8, 4)), confidence: "high",
    });
    // football on some evenings
    const football = (dow === 2 || dow === 4 || (isWeekend && rand() < 0.5)) && rand() < 0.7;
    if (football) {
      const dur = Math.round(clamp(70 + gauss() * 12, 45, 105));
      activities.push({
        id: mkId(), date, type: "Football", start: `${date}T18:30:00`, durationMin: dur,
        avgHr: Math.round(148 + gauss() * 8), maxHr: Math.round(182 + gauss() * 6),
        calories: Math.round(dur * 10.5), zones: [4, 8, dur * 0.3, dur * 0.4, dur * 0.15].map((z) => Math.round(z)),
        load: r1(clamp(12 + gauss() * 2.4, 7, 19)), confidence: "high",
      });
    }
    // running some mornings
    if (!football && rand() < 0.3) {
      const dur = Math.round(clamp(32 + gauss() * 8, 18, 55));
      activities.push({
        id: mkId(), date, type: "Running", start: `${date}T07:30:00`, durationMin: dur,
        avgHr: Math.round(154 + gauss() * 7), maxHr: Math.round(178 + gauss() * 6),
        calories: Math.round(dur * 11), zones: [2, 4, dur * 0.4, dur * 0.4, dur * 0.1].map((z) => Math.round(z)),
        load: r1(clamp(dur / 5 + 3, 4, 12)), confidence: "high",
      });
    }
    // gym some days
    if (!football && rand() < 0.28) {
      const dur = Math.round(clamp(55 + gauss() * 12, 35, 90));
      activities.push({
        id: mkId(), date, type: "Gym", start: `${date}T17:00:00`, durationMin: dur,
        avgHr: Math.round(118 + gauss() * 8), maxHr: Math.round(158 + gauss() * 10),
        calories: Math.round(dur * 6.5), zones: [dur * 0.35, dur * 0.4, dur * 0.2, dur * 0.05, 0].map((z) => Math.round(z)),
        load: r1(clamp(dur / 10 + 3, 4, 11)), confidence: "high",
      });
    }
    // low-confidence unrecognized HR spike (the thing we must NOT call a workout)
    if (rand() < 0.22) {
      const dur = Math.round(clamp(6 + gauss() * 4, 3, 16));
      activities.push({
        id: mkId(), date, type: "Unrecognized elevated HR", start: `${date}T15:10:00`, durationMin: dur,
        avgHr: Math.round(128 + gauss() * 10), maxHr: Math.round(150 + gauss() * 12),
        calories: Math.round(dur * 6), zones: [1, dur - 3, 2, 0, 0].map((z) => Math.max(0, z)),
        load: r1(clamp(dur / 12, 0.4, 1.6)), confidence: "low",
      });
    }

    prevFootball = football;
    prevStrain = clamp(activities.filter((a) => a.confidence !== "low").reduce((s, a) => s + a.load, 0), 3, 21);
    const steps = Math.round(clamp(6800 + walkMin * 90 + (football ? 3200 : 0) + gauss() * 1500, 1500, 24000));
    const activeCalories = Math.round(activities.reduce((s, a) => s + a.calories, 0) + steps * 0.03);
    const restingCalories = Math.round(1500 + fitness * 6);

    // --- meals ---
    const meals = buildMeals(date, rand, isWeekend || football, drank);

    // --- medication events ---
    const medicationEvents: MedicationEvent[] = [];
    for (const med of MEDICATIONS) {
      if (med.frequency === "as-needed") {
        if (football && rand() < 0.6)
          medicationEvents.push({ id: `${date}-${med.id}`, medicationId: med.id, date, scheduled: "18:00", status: "taken", takenAt: "18:05" });
        continue;
      }
      for (const time of med.times) {
        const roll = rand();
        const status = roll < 0.8 ? "taken" : roll < 0.9 ? "delayed" : "skipped";
        medicationEvents.push({
          id: `${date}-${med.id}-${time}`, medicationId: med.id, date, scheduled: time, status,
          takenAt: status === "taken" ? time : status === "delayed" ? shift(time, 45 + Math.round(rand() * 90)) : undefined,
        });
      }
    }

    // --- journal ---
    const recoveryProxy = clamp(hrv - rhr + 40, 0, 100);
    const journal: JournalEntry = {
      date,
      ratings: {
        mood: Math.round(clamp(6.4 + (recoveryProxy - 50) * 0.03 + (isWeekend ? 0.6 : 0) + gauss() * 0.8, 1, 10)),
        stress: Math.round(clamp(5 - (recoveryProxy - 50) * 0.03 + (isWeekend ? -0.8 : 0.4) + gauss() * 1.1, 1, 10)),
        energy: Math.round(clamp(5.6 + (asleepMin - 450) / 40 + gauss() * 0.9, 1, 10)),
        focus: Math.round(clamp(6 + (recoveryProxy - 50) * 0.02 - (drank ? 1 : 0) + gauss(), 1, 10)),
        sleepQuality: Math.round(clamp(efficiencyPct / 10 + gauss() * 0.6, 1, 10)),
      },
      tags: [
        ...(cigarettes ? [{ label: "Smoking", intensity: cigarettes, notes: `${cigarettes} cigarettes` }] : []),
        ...(caffeineCups ? [{ label: "Caffeine", intensity: caffeineCups }] : []),
        ...(drank ? [{ label: "Alcohol", intensity: Math.round(1 + rand() * 3) }] : []),
        ...(football ? [{ label: "Football", durationMin: activities.find((a) => a.type === "Football")?.durationMin }] : []),
        ...(!isWeekend ? [{ label: "Studying", durationMin: Math.round(90 + rand() * 150) }] : []),
        ...(isWeekend && rand() < 0.5 ? [{ label: "Social event" }] : []),
      ],
      note: football ? "Good game tonight, legs heavy after." : drank ? "Went out with friends." : undefined,
    };

    const sleep: SleepSession = {
      date, bedtime, wake, inBedMin: Math.round(inBedMin), asleepMin: Math.round(asleepMin),
      efficiencyPct: Math.round(efficiencyPct),
      stages: { awake: Math.round(awake), light: Math.round(light), deep: Math.round(deep), rem: Math.round(rem) },
      awakenings, sleepHrBpm: sleepHr, overnightHrvMs: hrv, consistencyPct: consistency,
      debtMin: Math.round(sleepDebt), needMin: Math.round(needMin),
    };

    days.push({
      date,
      hrv: { date, rmssdMs: hrv },
      rhr: { date, bpm: rhr },
      sleep,
      activities,
      steps,
      activeCalories,
      restingCalories,
      meals,
      medicationEvents,
      journal,
      weightKg: r1(clamp(79.5 - fitness * 0.35 + gauss() * 0.3, 74, 82)),
    });
  }

  return {
    days,
    medications: MEDICATIONS,
    planner: buildPlanner(end),
    goals: GOALS,
    profile: { name: "You", device: "Fitbit Air" },
  };
}

function shift(hhmm: string, addMin: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + addMin;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function buildPlanner(end: string): PlannerTask[] {
  const tasks: PlannerTask[] = [];
  let id = 0;
  const mk = (t: Partial<PlannerTask> & { title: string; date: string; kind: PlannerTask["kind"] }): PlannerTask => ({
    id: `t${id++}`, priority: "medium", done: false, ...t,
  });
  // build across -3..+10 days
  for (let d = -3; d <= 10; d++) {
    const date = addDays(end, d);
    const dow = new Date(date + "T12:00:00").getDay();
    const weekday = dow >= 1 && dow <= 5;
    const past = d < 0;
    if (weekday) {
      tasks.push(mk({ title: "Statistics lecture", date, kind: "class", start: "09:00", estMin: 90, done: past }));
      tasks.push(mk({ title: "Study block", date, kind: "task", start: "16:00", estMin: 120, priority: "high", done: past && d < -1 }));
    }
    if (dow === 3) tasks.push(mk({ title: "Data Structures assignment", date, kind: "assignment", priority: "high", estMin: 180, done: past }));
    if (dow === 2 || dow === 4) tasks.push(mk({ title: "Football", date, kind: "workout", start: "18:30", estMin: 75, done: past }));
    if (dow === 6) tasks.push(mk({ title: "Weekend work shift", date, kind: "work", start: "10:00", estMin: 360, done: past }));
  }
  tasks.push(mk({ title: "Algorithms midterm exam", date: addDays(end, 5), kind: "exam", start: "10:00", estMin: 120, priority: "high" }));
  tasks.push(mk({ title: "Submit lab report", date: addDays(end, 2), kind: "assignment", priority: "high", estMin: 90 }));
  return tasks;
}
