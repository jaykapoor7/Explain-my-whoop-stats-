import { DayRecord, Workout } from "../types";
import { parseCsv, num, toDateKey, toHourOfDay } from "./csv";
import { ParsedFile, Provider } from "./provider";

/**
 * WHOOP data export: physiological_cycles.csv, sleeps.csv, workouts.csv,
 * journal_entries.csv. Header names follow WHOOP's export format.
 */

function get(row: Record<string, string>, ...names: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const name of names) {
    const k = keys.find((key) => key.toLowerCase() === name.toLowerCase());
    if (k && row[k] !== "") return row[k];
  }
  return undefined;
}

function isCycles(headers: string[]): boolean {
  const h = headers.join("|").toLowerCase();
  return h.includes("recovery score") || (h.includes("heart rate variability") && h.includes("day strain"));
}
function isSleeps(headers: string[]): boolean {
  const h = headers.join("|").toLowerCase();
  return h.includes("sleep performance") || h.includes("asleep duration") || h.includes("sleep efficiency");
}
function isWorkouts(headers: string[]): boolean {
  const h = headers.join("|").toLowerCase();
  return h.includes("activity name") || (h.includes("activity strain") && h.includes("duration"));
}
function isJournal(headers: string[]): boolean {
  const h = headers.join("|").toLowerCase();
  return h.includes("question text") || h.includes("answered yes");
}

export const whoopProvider: Provider = {
  id: "whoop",
  label: "WHOOP",
  detect(file) {
    if (!file.name.toLowerCase().endsWith(".csv")) return 0;
    const rows = parseCsv(file.text.slice(0, 20000));
    if (!rows.length) return 0;
    const headers = Object.keys(rows[0]);
    if (isCycles(headers) || isSleeps(headers) || isWorkouts(headers) || isJournal(headers)) return 0.95;
    return 0;
  },
  parse(files) {
    const days = new Map<string, DayRecord>();
    const day = (date: string): DayRecord => {
      if (!days.has(date)) days.set(date, { date });
      return days.get(date)!;
    };

    for (const file of files) {
      const rows = parseCsv(file.text);
      if (!rows.length) continue;
      const headers = Object.keys(rows[0]);

      if (isCycles(headers)) {
        for (const r of rows) {
          const date = toDateKey(get(r, "Cycle start time", "Cycle timezone", "Cycle end time"));
          if (!date) continue;
          const rec = day(date);
          rec.recovery = num(get(r, "Recovery score %", "Recovery score")) ?? rec.recovery;
          rec.hrv = num(get(r, "Heart rate variability (ms)", "HRV (ms)")) ?? rec.hrv;
          rec.rhr = num(get(r, "Resting heart rate (bpm)")) ?? rec.rhr;
          rec.strain = num(get(r, "Day Strain", "Strain")) ?? rec.strain;
          rec.calories = num(get(r, "Energy burned (cal)", "Calories burned")) ?? rec.calories;
          rec.maxHr = num(get(r, "Max HR (bpm)")) ?? rec.maxHr;
          rec.spo2 = num(get(r, "Blood oxygen %")) ?? rec.spo2;
          rec.skinTempC = num(get(r, "Skin temp (celsius)")) ?? rec.skinTempC;
          rec.respiratoryRate = num(get(r, "Respiratory rate (rpm)")) ?? rec.respiratoryRate;
        }
      } else if (isSleeps(headers)) {
        for (const r of rows) {
          // Attribute the night to the wake-up date.
          const date =
            toDateKey(get(r, "Wake onset", "Cycle end time")) ??
            toDateKey(get(r, "Cycle start time", "Sleep onset"));
          if (!date) continue;
          const rec = day(date);
          const asleepMin = num(get(r, "Asleep duration (min)"));
          const inBedMin = num(get(r, "In bed duration (min)"));
          rec.sleepHours = asleepMin !== undefined ? Math.round((asleepMin / 60) * 10) / 10 : rec.sleepHours;
          rec.sleepEfficiency = num(get(r, "Sleep efficiency %")) ?? rec.sleepEfficiency;
          rec.sleepConsistency = num(get(r, "Sleep consistency %")) ?? rec.sleepConsistency;
          const need = num(get(r, "Sleep need (min)"));
          rec.sleepNeedHours = need !== undefined ? Math.round((need / 60) * 10) / 10 : rec.sleepNeedHours;
          const debt = num(get(r, "Sleep debt (min)"));
          rec.sleepDebtHours = debt !== undefined ? Math.round((debt / 60) * 10) / 10 : rec.sleepDebtHours;
          const deep = num(get(r, "Deep (SWS) duration (min)"));
          const rem = num(get(r, "REM duration (min)"));
          const light = num(get(r, "Light sleep duration (min)"));
          const awake = num(get(r, "Awake duration (min)"));
          if (deep !== undefined) rec.deepHours = Math.round((deep / 60) * 10) / 10;
          if (rem !== undefined) rec.remHours = Math.round((rem / 60) * 10) / 10;
          if (light !== undefined) rec.lightHours = Math.round((light / 60) * 10) / 10;
          if (awake !== undefined) rec.awakeHours = Math.round((awake / 60) * 10) / 10;
          else if (inBedMin !== undefined && asleepMin !== undefined)
            rec.awakeHours = Math.round(((inBedMin - asleepMin) / 60) * 10) / 10;
          rec.bedtimeHour = toHourOfDay(get(r, "Sleep onset"), true) ?? rec.bedtimeHour;
          rec.wakeHour = toHourOfDay(get(r, "Wake onset")) ?? rec.wakeHour;
        }
      } else if (isWorkouts(headers)) {
        for (const r of rows) {
          const date = toDateKey(get(r, "Workout start time", "Cycle start time"));
          if (!date) continue;
          const rec = day(date);
          const w: Workout = {
            date,
            sport: get(r, "Activity name") ?? "Workout",
            durationMin: num(get(r, "Duration (min)")) ?? 0,
            strain: num(get(r, "Activity Strain", "Strain")),
            calories: num(get(r, "Energy burned (cal)")),
            avgHr: num(get(r, "Average HR (bpm)")),
            maxHr: num(get(r, "Max HR (bpm)")),
            startHour: toHourOfDay(get(r, "Workout start time")),
          };
          const zones = [
            num(get(r, "HR Zone 1 %")),
            num(get(r, "HR Zone 2 %")),
            num(get(r, "HR Zone 3 %")),
            num(get(r, "HR Zone 4 %")),
            num(get(r, "HR Zone 5 %")),
          ];
          if (zones.some((z) => z !== undefined) && w.durationMin) {
            w.zones = zones.map((z) => Math.round(((z ?? 0) / 100) * w.durationMin));
          }
          rec.workouts = [...(rec.workouts ?? []), w];
        }
      } else if (isJournal(headers)) {
        for (const r of rows) {
          const date = toDateKey(get(r, "Cycle start time", "Date"));
          if (!date) continue;
          const rec = day(date);
          const q = (get(r, "Question text") ?? "").toLowerCase();
          const yes = (get(r, "Answered yes") ?? "").toLowerCase() === "true";
          const notesVal = num(get(r, "Notes"));
          if (q.includes("alcohol")) rec.alcoholDrinks = yes ? (notesVal ?? 2) : 0;
          else if (q.includes("caffeine")) rec.caffeineMg = yes ? (notesVal ?? 150) : 0;
          else if (q.includes("travel")) rec.travel = yes;
          else if (q.includes("sauna")) rec.sauna = yes;
          else if (q.includes("meditat")) rec.meditation = yes;
          else if (q.includes("stress")) rec.stress = yes ? 7 : 3;
        }
      }
    }
    return [...days.values()];
  },
};
