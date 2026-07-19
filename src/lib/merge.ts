import { DayRecord } from "./types";

/**
 * Merge day records from multiple sources into one sorted timeline.
 * `incoming` fills gaps in `base` without clobbering existing values;
 * workouts are unioned. Used by both file import and live device sync.
 */
export function mergeDays(base: DayRecord[], incoming: DayRecord[]): DayRecord[] {
  const map = new Map<string, DayRecord>();
  for (const rec of base) map.set(rec.date, { ...rec });

  for (const rec of incoming) {
    const existing = map.get(rec.date);
    if (!existing) {
      map.set(rec.date, { ...rec });
      continue;
    }
    for (const [k, v] of Object.entries(rec)) {
      if (v === undefined) continue;
      if (k === "workouts") {
        existing.workouts = [...(existing.workouts ?? []), ...(rec.workouts ?? [])];
      } else if ((existing as unknown as Record<string, unknown>)[k] === undefined) {
        (existing as unknown as Record<string, unknown>)[k] = v;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
