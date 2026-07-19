import { CalendarEvent, DayRecord } from "../types";

/**
 * Materializes per-day calendar features onto DayRecords so the whole
 * analytics stack (insights, correlations, chat, coach) can treat life
 * context exactly like any other metric.
 */

const IN_PERSON_LOCATION = /office|hq|building|floor|room|campus|conference/i;
const VIRTUAL_LOCATION = /zoom|meet\.|teams|webex|http/i;

export interface DayEvents {
  all: CalendarEvent[];
  meetings: CalendarEvent[];
  social: CalendarEvent[];
  travel: CalendarEvent[];
  workouts: CalendarEvent[];
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, DayEvents> {
  const map = new Map<string, DayEvents>();
  for (const ev of events) {
    let g = map.get(ev.date);
    if (!g) {
      g = { all: [], meetings: [], social: [], travel: [], workouts: [] };
      map.set(ev.date, g);
    }
    g.all.push(ev);
    if (ev.type === "meeting") g.meetings.push(ev);
    else if (ev.type === "social") g.social.push(ev);
    else if (ev.type === "travel" || ev.type === "vacation") g.travel.push(ev);
    else if (ev.type === "workout") g.workouts.push(ev);
  }
  return map;
}

export function enrichDaysWithCalendar(days: DayRecord[], events: CalendarEvent[]): DayRecord[] {
  if (!events.length) return days;
  const byDate = groupEventsByDate(events);
  return days.map((day) => {
    const g = byDate.get(day.date);
    const dow = new Date(day.date + "T12:00:00").getDay();
    const workday = dow >= 1 && dow <= 5;
    if (!g) return { ...day, workday, meetingCount: workday ? 0 : undefined, meetingMinutes: workday ? 0 : undefined };

    const meetings = g.meetings.filter((m) => !m.allDay);
    const meetingMinutes = meetings.reduce((a, m) => a + m.durationMin, 0);
    const sorted = [...meetings].sort((a, b) => a.startHour - b.startHour);
    let backToBack = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startHour - sorted[i - 1].endHour <= 0.09) backToBack++;
    }
    const eveningEvents = g.all.filter((e) => !e.allDay && e.endHour >= 20 && (e.type === "social" || e.type === "meeting" || e.type === "study"));
    const inPerson = meetings.some(
      (m) => m.location && IN_PERSON_LOCATION.test(m.location) && !VIRTUAL_LOCATION.test(m.location)
    );

    return {
      ...day,
      workday,
      meetingCount: meetings.length,
      meetingMinutes,
      firstMeetingHour: sorted.length ? sorted[0].startHour : undefined,
      backToBackMeetings: backToBack,
      hasEveningEvent: eveningEvents.length > 0,
      eveningEventHour: eveningEvents.length ? Math.max(...eveningEvents.map((e) => e.endHour)) : undefined,
      hasFlight: g.travel.some((t) => t.type === "travel"),
      officeDay: meetings.length ? inPerson : undefined,
      travel: day.travel || g.travel.some((t) => t.type === "travel") || undefined,
    };
  });
}
