import { CalendarEvent } from "../types";
import { classifyEvent } from "./classify";

/**
 * ICS (RFC 5545) parser for Google Calendar / Apple Calendar exports.
 * Handles line unfolding, quoted params, all-day events, and basic
 * RRULE expansion (DAILY / WEEKLY with INTERVAL, COUNT, UNTIL, BYDAY).
 * Runs entirely client-side.
 */

interface RawEvent {
  summary: string;
  location?: string;
  start?: Date;
  end?: Date;
  allDay: boolean;
  rrule?: string;
}

function unfold(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else out.push(line);
  }
  return out;
}

function parseIcsDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const isDateOnly = params.includes("VALUE=DATE") || /^\d{8}$/.test(value);
  if (isDateOnly) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0), allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/);
  if (!m) return null;
  // TZID-specific conversion is intentionally skipped: for daily aggregation,
  // treating floating/zoned times as local is a reasonable approximation.
  const date = m[7] === "Z"
    ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
    : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return { date, allDay: false };
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BYDAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Expand a recurring event into concrete dates within [rangeStart, rangeEnd]. Capped at 400 instances. */
function expandRrule(ev: RawEvent, rangeStart: Date, rangeEnd: Date): Date[] {
  if (!ev.start) return [];
  if (!ev.rrule) return [ev.start];
  const parts = Object.fromEntries(
    ev.rrule.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k, v] as const;
    })
  );
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY") return [ev.start]; // other freqs: first instance only
  const interval = Math.max(1, parseInt(parts.INTERVAL ?? "1", 10) || 1);
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : Infinity;
  let until = rangeEnd;
  if (parts.UNTIL) {
    const u = parseIcsDate(parts.UNTIL, "");
    if (u) until = u.date < rangeEnd ? u.date : rangeEnd;
  }
  const byday = parts.BYDAY
    ? parts.BYDAY.split(",").map((d) => BYDAY_MAP[d.replace(/^[-+]?\d+/, "")]).filter((d) => d !== undefined)
    : null;

  const out: Date[] = [];
  const cursor = new Date(ev.start);
  let emitted = 0;
  let guard = 0;
  while (cursor <= until && emitted < count && out.length < 400 && guard++ < 5000) {
    const matchesDay = freq === "DAILY" || !byday || byday.includes(cursor.getDay());
    if (matchesDay) {
      emitted++;
      if (cursor >= rangeStart) out.push(new Date(cursor));
    }
    if (freq === "DAILY") cursor.setDate(cursor.getDate() + interval);
    else if (byday) {
      // weekly with BYDAY: step day-by-day, jumping interval-1 weeks at week boundaries
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === (ev.start.getDay() + 1) % 7 && interval > 1) {
        cursor.setDate(cursor.getDate() + (interval - 1) * 7);
      }
    } else cursor.setDate(cursor.getDate() + interval * 7);
  }
  return out;
}

export function parseIcs(text: string, rangeStart?: string, rangeEnd?: string): CalendarEvent[] {
  const lines = unfold(text);
  const raws: RawEvent[] = [];
  let cur: RawEvent | null = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      cur = { summary: "", allDay: false };
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (cur?.start && cur.summary) raws.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const keyPart = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const key = keyPart.split(";")[0].toUpperCase();
    if (key === "SUMMARY") cur.summary = value.replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
    else if (key === "LOCATION") cur.location = value.replace(/\\,/g, ",").trim() || undefined;
    else if (key === "DTSTART") {
      const parsed = parseIcsDate(value, keyPart);
      if (parsed) {
        cur.start = parsed.date;
        cur.allDay = parsed.allDay;
      }
    } else if (key === "DTEND") {
      const parsed = parseIcsDate(value, keyPart);
      if (parsed) cur.end = parsed.date;
    } else if (key === "RRULE") cur.rrule = value;
  }

  const lo = rangeStart ? new Date(rangeStart + "T00:00:00") : new Date(Date.now() - 400 * 864e5);
  const hi = rangeEnd ? new Date(rangeEnd + "T23:59:59") : new Date(Date.now() + 30 * 864e5);

  const events: CalendarEvent[] = [];
  let idCounter = 0;
  for (const raw of raws) {
    const durationMs =
      raw.end && raw.start && !raw.allDay ? Math.max(0, raw.end.getTime() - raw.start.getTime()) : 0;
    for (const instance of expandRrule(raw, lo, hi)) {
      if (instance < lo || instance > hi) continue;
      const startHour = raw.allDay ? 0 : instance.getHours() + instance.getMinutes() / 60;
      const durationMin = raw.allDay ? 0 : Math.round(durationMs / 60000);
      events.push({
        id: `ics-${idCounter++}`,
        date: dateKey(instance),
        title: raw.summary,
        type: classifyEvent(raw.summary, raw.location, raw.allDay),
        startHour: Math.round(startHour * 10) / 10,
        endHour: Math.round((startHour + durationMin / 60) * 10) / 10,
        durationMin,
        location: raw.location,
        allDay: raw.allDay,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
}
