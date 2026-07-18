import { DayRecord, Workout } from "./types";

/**
 * Seeded demo dataset: ~180 days of physiologically plausible data with
 * built-in relationships the insight engine can rediscover (sleep -> HRV,
 * alcohol -> recovery, weekend effect, strain -> next-night sleep, travel -> RHR).
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260718);
const gauss = () => {
  // Box-Muller
  const u = Math.max(1e-9, rand());
  const v = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const SPORTS = ["Weightlifting", "Running", "Cycling", "Tennis", "Yoga", "HIIT"];

export function generateDemoData(days = 182): DayRecord[] {
  const records: DayRecord[] = [];
  const end = new Date();
  end.setHours(12, 0, 0, 0);

  let sleepDebt = 0.5;
  let prevStrain = 10;
  let travelCooldown = 0;
  let fitnessDrift = 0; // slow improvement over the period
  // Lifestyle logged on day D affects the night that ends on morning D+1.
  let prevAlcohol = 0;
  let prevLateCaffeine = false;
  let prevMeditation = false;
  let prevLateWorkout = false;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    const isWeekend = dow === 0 || dow === 6;
    const dayIndex = days - 1 - i;
    fitnessDrift = dayIndex * 0.012;

    // ---- lifestyle drivers ----
    const travel = travelCooldown === 0 && rand() < 0.035;
    if (travel) travelCooldown = 6;
    else if (travelCooldown > 0) travelCooldown--;

    const social = isWeekend ? rand() < 0.55 : rand() < 0.12;
    const alcoholDrinks = social ? Math.round(clamp(gauss() * 1.2 + (dow === 5 || dow === 6 ? 2.2 : 1.2), 0, 6)) : 0;
    const caffeineMg = Math.round(clamp(160 + gauss() * 70 + (sleepDebt > 1.5 ? 60 : 0), 0, 420));
    const lateCaffeine = caffeineMg > 220 && rand() < 0.4;
    const meditation = rand() < 0.3;
    const sauna = rand() < 0.15;

    // ---- sleep (night ending on this date; driven by *yesterday's* behaviors) ----
    const lateNight = prevAlcohol >= 2 || (isWeekend && rand() < 0.4);
    let bedtimeHour = 22.6 + gauss() * 0.7 + (lateNight ? 1.6 : 0) + (prevLateCaffeine ? 0.5 : 0);
    bedtimeHour = clamp(bedtimeHour, 21, 27.5); // 27.5 == 3:30am
    const highStrainYesterday = prevStrain > 14.5;
    let sleepHours =
      7.3 +
      gauss() * 0.65 +
      (highStrainYesterday ? 0.72 : 0) + // more sleep after big days
      (isWeekend ? 0.35 : 0) -
      (bedtimeHour > 24 ? 0.8 : 0) -
      (travel ? 0.9 : 0);
    sleepHours = clamp(sleepHours, 4.2, 9.8);

    let sleepEfficiency =
      88 +
      gauss() * 3.2 -
      prevAlcohol * 1.8 -
      (prevLateCaffeine ? 2.4 : 0) -
      (prevLateWorkout ? 2.2 : 0) -
      (travel ? 3 : 0) +
      (prevMeditation ? 1.2 : 0);
    sleepEfficiency = clamp(sleepEfficiency, 68, 97);

    const sleepNeedHours = clamp(7.7 + prevStrain * 0.045 + sleepDebt * 0.25, 7.4, 9.6);
    sleepDebt = clamp(sleepDebt + (sleepNeedHours - sleepHours) * 0.55, 0, 5);

    const deepShare = clamp(0.2 + gauss() * 0.025 - prevAlcohol * 0.012, 0.1, 0.28);
    const remShare = clamp(0.24 + gauss() * 0.03 - prevAlcohol * 0.02 - (prevLateCaffeine ? 0.015 : 0), 0.12, 0.32);
    const awakeHours = round1(clamp((100 - sleepEfficiency) * 0.045, 0.2, 1.6));

    const wakeHour = clamp(bedtimeHour - 24 + sleepHours + awakeHours + 24, 5, 11.5) % 24;

    const sleepConsistency = clamp(
      86 - Math.abs(bedtimeHour - 22.8) * 6 - (travel ? 8 : 0) + gauss() * 4,
      40,
      98
    );

    // ---- physiology ----
    const sleepBoost = (sleepHours - 7) * 4.4;
    let hrv =
      62 +
      fitnessDrift * 2.4 +
      sleepBoost +
      gauss() * 6 -
      prevAlcohol * 5.2 -
      (travel ? 7 : 0) -
      (highStrainYesterday ? 4.5 : 0) +
      (prevMeditation ? 1.8 : 0);
    hrv = clamp(hrv, 24, 118);

    let rhr =
      55 -
      fitnessDrift * 0.6 -
      (sleepHours - 7) * 0.7 +
      prevAlcohol * 1.7 +
      (travel ? 4.2 : 0) +
      (highStrainYesterday ? 1.4 : 0) +
      gauss() * 1.6;
    rhr = clamp(rhr, 44, 72);

    let recovery =
      34 +
      (hrv - 45) * 1.05 -
      (rhr - 54) * 1.35 +
      (sleepHours - 7) * 3.4 +
      (sleepEfficiency - 86) * 0.5 +
      (isWeekend ? 3.5 : 0) +
      gauss() * 6;
    recovery = clamp(recovery, 3, 99);

    // ---- activity ----
    const restDay = recovery < 34 ? rand() < 0.7 : rand() < 0.18;
    const workouts: Workout[] = [];
    let strain: number;
    if (restDay) {
      strain = clamp(6 + gauss() * 1.6, 3, 9.5);
    } else {
      const sport = SPORTS[Math.floor(rand() * SPORTS.length)];
      const hard = recovery > 60 ? rand() < 0.55 : rand() < 0.25;
      const durationMin = Math.round(clamp((hard ? 72 : 48) + gauss() * 15, 25, 130));
      const startHour = clamp(rand() < 0.3 ? 18.5 + gauss() * 1.4 : 8 + gauss() * 4.5, 5.5, 22);
      const wStrain = round1(clamp((hard ? 13.5 : 9.5) + gauss() * 2.2, 4, 19.5));
      const avgHr = Math.round(clamp(sport === "Yoga" ? 96 : 132 + gauss() * 12 + (hard ? 8 : 0), 85, 172));
      const maxHr = Math.round(clamp(avgHr + 26 + gauss() * 8, 110, 196));
      const z = [0.08, 0.22, 0.34, 0.26, 0.1].map((s) => Math.round(durationMin * clamp(s + gauss() * 0.03, 0.02, 0.6)));
      workouts.push({
        date,
        sport,
        durationMin,
        strain: wStrain,
        calories: Math.round(durationMin * (sport === "Yoga" ? 4 : 9) + gauss() * 40),
        avgHr,
        maxHr,
        startHour: round1(startHour),
        zones: z,
      });
      if (rand() < 0.12) {
        workouts.push({
          date,
          sport: "Walking",
          durationMin: Math.round(30 + rand() * 30),
          strain: round1(4 + rand() * 3),
          calories: Math.round(120 + rand() * 120),
          avgHr: Math.round(95 + rand() * 15),
          maxHr: Math.round(115 + rand() * 15),
          startHour: round1(12 + rand() * 6),
        });
      }
      strain = clamp(Math.max(...workouts.map((w) => w.strain ?? 8)) + 1.5 + gauss(), 5, 20.6);
    }
    prevStrain = strain;

    const steps = Math.round(clamp(6200 + strain * 420 + (isWeekend ? 900 : 0) + gauss() * 1800, 1500, 24000));
    const calories = Math.round(clamp(1850 + strain * 62 + gauss() * 150, 1500, 4200));
    const maxHr = workouts.length
      ? Math.max(...workouts.map((w) => w.maxHr ?? 120))
      : Math.round(clamp(112 + gauss() * 10, 95, 145));

    // ---- subjective ----
    const stress = round1(clamp(5.2 - (recovery - 50) * 0.035 + (travel ? 1.6 : 0) + gauss() * 1.2 + (isWeekend ? -0.7 : 0), 1, 10));
    const mood = round1(clamp(6.4 + (recovery - 50) * 0.03 + (isWeekend ? 0.5 : 0) - stress * 0.18 + gauss() * 0.9, 1, 10));
    const proteinG = Math.round(clamp(118 + gauss() * 28 + (workouts.length ? 18 : 0), 40, 220));
    const calorieIntake = Math.round(clamp(2350 + strain * 28 + gauss() * 260, 1500, 3900));
    const screenTimeMin = Math.round(clamp(196 + gauss() * 55 + (isWeekend ? 42 : 0) - (meditation ? 25 : 0), 45, 460));

    const notes: string[] = [];
    if (travel) notes.push("Travel day — flight + hotel.");
    if (alcoholDrinks >= 3) notes.push("Big night out.");
    else if (alcoholDrinks > 0) notes.push(`${alcoholDrinks} drink${alcoholDrinks > 1 ? "s" : ""} in the evening.`);
    if (highStrainYesterday) notes.push("Feeling yesterday's session in the legs.");
    if (sauna) notes.push("Sauna in the evening.");
    if (recovery > 88) notes.push("Felt fantastic today.");
    if (recovery < 25) notes.push("Dragging all day, low energy.");

    records.push({
      date,
      recovery: Math.round(recovery),
      hrv: Math.round(hrv),
      rhr: Math.round(rhr),
      spo2: round1(clamp(96.4 + gauss() * 0.7, 93, 99)),
      skinTempC: round1(clamp(33.8 + gauss() * 0.3 + (prevAlcohol > 2 ? 0.4 : 0), 32.5, 35.5)),
      respiratoryRate: round1(clamp(15.1 + gauss() * 0.5 + prevAlcohol * 0.15, 12, 19)),
      sleepHours: round1(sleepHours),
      sleepNeedHours: round1(sleepNeedHours),
      sleepDebtHours: round1(sleepDebt),
      sleepEfficiency: Math.round(sleepEfficiency),
      sleepConsistency: Math.round(sleepConsistency),
      deepHours: round1(sleepHours * deepShare),
      remHours: round1(sleepHours * remShare),
      lightHours: round1(sleepHours * (1 - deepShare - remShare)),
      awakeHours,
      bedtimeHour: round1(bedtimeHour),
      wakeHour: round1(wakeHour),
      strain: round1(strain),
      steps,
      calories,
      activeCalories: Math.round(calories - 1600),
      maxHr,
      workouts,
      alcoholDrinks,
      caffeineMg,
      lateCaffeine,
      stress,
      mood,
      proteinG,
      calorieIntake,
      screenTimeMin,
      travel,
      sauna,
      meditation,
      notes: notes.join(" ") || undefined,
    });

    prevAlcohol = alcoholDrinks;
    prevLateCaffeine = lateCaffeine;
    prevMeditation = meditation;
    prevLateWorkout = workouts.some((w) => (w.startHour ?? 0) >= 18);
  }
  return records;
}
