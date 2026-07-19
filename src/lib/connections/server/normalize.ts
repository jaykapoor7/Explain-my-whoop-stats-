import "server-only";
import { DayRecord, Workout } from "../../types";

/** Accumulates partial day records keyed by date during a provider sync. */
export class DayBuilder {
  private map = new Map<string, DayRecord>();

  day(date: string): DayRecord {
    let d = this.map.get(date);
    if (!d) {
      d = { date };
      this.map.set(date, d);
    }
    return d;
  }

  addWorkout(date: string, w: Workout) {
    const d = this.day(date);
    d.workouts = [...(d.workouts ?? []), w];
  }

  result(): DayRecord[] {
    return [...this.map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const round1 = (v: number) => Math.round(v * 10) / 10;
export const kjToKcal = (kj: number) => Math.round(kj * 0.239006);
export const msToH = (ms: number) => Math.round((ms / 3.6e6) * 10) / 10;

/** Local YYYY-MM-DD from an ISO timestamp (uses the date portion as-is). */
export function isoDate(ts: string): string {
  return ts.slice(0, 10);
}

/** Fractional local hour-of-day from an ISO timestamp. */
export function isoHour(ts: string, wrapLateNight = false): number | undefined {
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return undefined;
  let h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  if (wrapLateNight && h < 12) h += 24;
  return round1(h);
}

export function dateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 864e5);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
