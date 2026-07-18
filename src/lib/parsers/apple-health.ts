import { DayRecord } from "../types";
import { Provider } from "./provider";

/**
 * Apple Health export.xml — regex-based streaming over <Record .../> elements
 * (DOMParser chokes on multi-hundred-MB exports; attribute scanning is enough
 * for daily aggregation).
 */

const TYPE_MAP: Record<string, { field: keyof DayRecord; agg: "mean" | "sum"; scale?: number }> = {
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { field: "hrv", agg: "mean" },
  HKQuantityTypeIdentifierRestingHeartRate: { field: "rhr", agg: "mean" },
  HKQuantityTypeIdentifierStepCount: { field: "steps", agg: "sum" },
  HKQuantityTypeIdentifierActiveEnergyBurned: { field: "activeCalories", agg: "sum" },
  HKQuantityTypeIdentifierBasalEnergyBurned: { field: "calories", agg: "sum" },
  HKQuantityTypeIdentifierOxygenSaturation: { field: "spo2", agg: "mean", scale: 100 },
  HKQuantityTypeIdentifierRespiratoryRate: { field: "respiratoryRate", agg: "mean" },
  HKQuantityTypeIdentifierDietaryProtein: { field: "proteinG", agg: "sum" },
  HKQuantityTypeIdentifierDietaryEnergyConsumed: { field: "calorieIntake", agg: "sum" },
  HKQuantityTypeIdentifierDietaryCaffeine: { field: "caffeineMg", agg: "sum" },
};

const RECORD_RE = /<Record\s+([^>]*?)\/?>(?:<\/Record>)?/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(s))) out[m[1]] = m[2];
  return out;
}

export const appleHealthProvider: Provider = {
  id: "apple-health",
  label: "Apple Health",
  detect(file) {
    if (!file.name.toLowerCase().endsWith(".xml")) return 0;
    return file.text.includes("HealthData") || file.text.includes("HKQuantityTypeIdentifier") ? 0.95 : 0;
  },
  parse(files) {
    const acc = new Map<string, Record<string, { sum: number; n: number }>>();
    const sleepAcc = new Map<string, { asleep: number; inBed: number; deep: number; rem: number; core: number; awake: number }>();

    for (const file of files) {
      let m: RegExpExecArray | null;
      RECORD_RE.lastIndex = 0;
      while ((m = RECORD_RE.exec(file.text))) {
        const a = attrs(m[1]);
        const type = a.type;
        if (!type) continue;
        const start = a.startDate?.slice(0, 10);
        if (!start) continue;

        if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
          // Attribute the sleep to the END date (morning of waking).
          const dateKey = a.endDate?.slice(0, 10) ?? start;
          const startMs = Date.parse(a.startDate);
          const endMs = Date.parse(a.endDate);
          if (!isFinite(startMs) || !isFinite(endMs)) continue;
          const hours = (endMs - startMs) / 3.6e6;
          const s = sleepAcc.get(dateKey) ?? { asleep: 0, inBed: 0, deep: 0, rem: 0, core: 0, awake: 0 };
          const v = a.value ?? "";
          if (v.includes("AsleepDeep")) { s.deep += hours; s.asleep += hours; }
          else if (v.includes("AsleepREM")) { s.rem += hours; s.asleep += hours; }
          else if (v.includes("AsleepCore") || v.includes("AsleepUnspecified") || v === "HKCategoryValueSleepAnalysisAsleep") { s.core += hours; s.asleep += hours; }
          else if (v.includes("Awake")) s.awake += hours;
          else if (v.includes("InBed")) s.inBed += hours;
          sleepAcc.set(dateKey, s);
          continue;
        }

        const rule = TYPE_MAP[type];
        if (!rule) continue;
        const value = parseFloat(a.value);
        if (!isFinite(value)) continue;
        const byField = acc.get(start) ?? {};
        const cell = byField[rule.field as string] ?? { sum: 0, n: 0 };
        cell.sum += value * (rule.scale ?? 1);
        cell.n += 1;
        byField[rule.field as string] = cell;
        acc.set(start, byField);
      }
    }

    const days = new Map<string, DayRecord>();
    const day = (date: string) => {
      if (!days.has(date)) days.set(date, { date });
      return days.get(date)!;
    };
    for (const [date, fields] of acc) {
      const rec = day(date);
      for (const [field, { sum, n }] of Object.entries(fields)) {
        const rule = Object.values(TYPE_MAP).find((r) => r.field === field)!;
        (rec as unknown as Record<string, unknown>)[field] = Math.round((rule.agg === "mean" ? sum / n : sum) * 10) / 10;
      }
      if (rec.activeCalories !== undefined && rec.calories !== undefined) {
        rec.calories = Math.round(rec.calories + rec.activeCalories);
      }
    }
    for (const [date, s] of sleepAcc) {
      if (s.asleep < 1) continue; // ignore naps/fragments under an hour
      const rec = day(date);
      rec.sleepHours = Math.round(s.asleep * 10) / 10;
      if (s.deep) rec.deepHours = Math.round(s.deep * 10) / 10;
      if (s.rem) rec.remHours = Math.round(s.rem * 10) / 10;
      if (s.core) rec.lightHours = Math.round(s.core * 10) / 10;
      if (s.awake) rec.awakeHours = Math.round(s.awake * 10) / 10;
      const inBed = Math.max(s.inBed, s.asleep + s.awake);
      if (inBed > 0) rec.sleepEfficiency = Math.round((s.asleep / inBed) * 100);
    }
    return [...days.values()];
  },
};
