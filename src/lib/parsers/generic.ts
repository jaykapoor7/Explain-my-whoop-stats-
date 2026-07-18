import { DayRecord } from "../types";
import { parseCsv, num, toDateKey, toHourOfDay } from "./csv";
import { Provider } from "./provider";

/**
 * Generic CSV/JSON adapter: matches columns by keyword so exports from
 * Fitbit, Garmin, Oura, Polar, Coros, Samsung Health and hand-rolled
 * spreadsheets all land in the same model. Field synonyms below are the
 * extension point for provider-specific column names.
 */

type FieldRule = { field: keyof DayRecord; keywords: string[]; transform?: (v: number) => number };

const minToH = (v: number) => Math.round((v / 60) * 10) / 10;

const FIELD_RULES: FieldRule[] = [
  { field: "recovery", keywords: ["recovery score", "recovery", "readiness score", "readiness", "body battery"] },
  { field: "hrv", keywords: ["heart rate variability", "hrv", "rmssd"] },
  { field: "rhr", keywords: ["resting heart rate", "resting hr", "rhr", "lowest heart rate"] },
  { field: "sleepHours", keywords: ["asleep duration", "total sleep", "sleep duration", "hours of sleep", "minutes asleep", "sleep time"] },
  { field: "sleepEfficiency", keywords: ["sleep efficiency", "efficiency"] },
  { field: "sleepConsistency", keywords: ["sleep consistency", "consistency"] },
  { field: "sleepDebtHours", keywords: ["sleep debt"] },
  { field: "deepHours", keywords: ["deep sleep", "deep (sws)", "sws", "minutes deep"] },
  { field: "remHours", keywords: ["rem sleep", "rem duration", "minutes rem"] },
  { field: "lightHours", keywords: ["light sleep", "minutes light"] },
  { field: "awakeHours", keywords: ["awake duration", "minutes awake", "awake time"] },
  { field: "strain", keywords: ["day strain", "strain", "training load", "activity score"] },
  { field: "steps", keywords: ["steps", "step count"] },
  { field: "calories", keywords: ["calories burned", "energy burned", "total calories", "calories out", "active energy"] },
  { field: "maxHr", keywords: ["max hr", "max heart rate", "maximum heart rate"] },
  { field: "spo2", keywords: ["blood oxygen", "spo2", "oxygen saturation"] },
  { field: "respiratoryRate", keywords: ["respiratory rate", "breath rate", "breathing rate"] },
  { field: "skinTempC", keywords: ["skin temp", "body temperature", "temperature deviation"] },
  { field: "alcoholDrinks", keywords: ["alcohol"] },
  { field: "caffeineMg", keywords: ["caffeine"] },
  { field: "stress", keywords: ["stress level", "stress score", "stress"] },
  { field: "mood", keywords: ["mood"] },
  { field: "proteinG", keywords: ["protein"] },
  { field: "calorieIntake", keywords: ["calorie intake", "calories in", "food calories"] },
  { field: "screenTimeMin", keywords: ["screen time"] },
];

const DATE_KEYWORDS = ["date", "day", "cycle start", "timestamp", "summary_date", "calendar"];
const TIME_FIELDS: { field: keyof DayRecord; keywords: string[]; wrap: boolean }[] = [
  { field: "bedtimeHour", keywords: ["bedtime", "sleep onset", "bedtime_start", "sleep start"], wrap: true },
  { field: "wakeHour", keywords: ["wake time", "wake onset", "bedtime_end", "sleep end", "wakeup"], wrap: false },
];

function matchHeader(headers: string[], keywords: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function rowsToDays(rows: Record<string, string>[]): DayRecord[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const dateCol = matchHeader(headers, DATE_KEYWORDS);
  if (!dateCol) return [];

  const bound: { col: string; rule: FieldRule; minutes: boolean }[] = [];
  const used = new Set([dateCol]);
  for (const rule of FIELD_RULES) {
    const col = matchHeader(headers.filter((h) => !used.has(h)), rule.keywords);
    if (col) {
      used.add(col);
      const minutes =
        /min/i.test(col) &&
        ["sleepHours", "deepHours", "remHours", "lightHours", "awakeHours", "sleepDebtHours"].includes(
          rule.field as string
        );
      bound.push({ col, rule, minutes });
    }
  }
  if (!bound.length) return [];

  const days = new Map<string, DayRecord>();
  for (const r of rows) {
    const date = toDateKey(r[dateCol]);
    if (!date) continue;
    const rec = days.get(date) ?? { date };
    for (const { col, rule, minutes } of bound) {
      let v = num(r[col]);
      if (v === undefined) continue;
      if (minutes) v = minToH(v);
      if (rule.transform) v = rule.transform(v);
      (rec as unknown as Record<string, unknown>)[rule.field] = v;
    }
    for (const tf of TIME_FIELDS) {
      const col = matchHeader(headers, tf.keywords);
      if (col && r[col]) {
        const h = toHourOfDay(r[col], tf.wrap);
        if (h !== undefined) (rec as unknown as Record<string, unknown>)[tf.field] = h;
      }
    }
    const notesCol = matchHeader(headers, ["notes", "note", "journal"]);
    if (notesCol && r[notesCol]) rec.notes = r[notesCol];
    days.set(date, rec);
  }
  return [...days.values()];
}

function flattenJson(value: unknown): Record<string, string>[] {
  // Accept: array of objects, or object with a single array property (e.g. Oura {"sleep": [...]})
  let arr: unknown[] = [];
  if (Array.isArray(value)) arr = value;
  else if (value && typeof value === "object") {
    const arrays = Object.values(value).filter((v) => Array.isArray(v)) as unknown[][];
    if (arrays.length) arr = arrays.flat();
  }
  return arr
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((obj) => {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue;
        if (typeof v === "object") {
          for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
            if (typeof v2 === "number" || typeof v2 === "string") flat[`${k} ${k2}`] = String(v2);
          }
        } else flat[k] = String(v);
      }
      return flat;
    });
}

export const genericProvider: Provider = {
  id: "generic",
  label: "Generic CSV / JSON",
  detect(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      const rows = parseCsv(file.text.slice(0, 20000));
      if (!rows.length) return 0;
      const headers = Object.keys(rows[0]);
      if (!matchHeader(headers, DATE_KEYWORDS)) return 0;
      return FIELD_RULES.some((r) => matchHeader(headers, r.keywords)) ? 0.5 : 0;
    }
    if (name.endsWith(".json")) {
      try {
        const rows = flattenJson(JSON.parse(file.text));
        if (!rows.length) return 0;
        const headers = Object.keys(rows[0]);
        return matchHeader(headers, DATE_KEYWORDS) ? 0.5 : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  },
  parse(files) {
    const all: DayRecord[] = [];
    for (const file of files) {
      if (file.name.toLowerCase().endsWith(".json")) {
        try {
          all.push(...rowsToDays(flattenJson(JSON.parse(file.text))));
        } catch {
          // skip malformed JSON
        }
      } else {
        all.push(...rowsToDays(parseCsv(file.text)));
      }
    }
    return all;
  },
};
