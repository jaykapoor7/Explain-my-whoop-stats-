"use client";

import { useMemo } from "react";
import { useApp } from "./store";
import { enrichDaysWithCalendar, groupEventsByDate, DayEvents } from "./calendar/features";
import { CalendarEvent, DayRecord } from "./types";

/**
 * Single read-path for pages: days with calendar context materialized as
 * ordinary metrics, so every analysis surface sees the same enriched view.
 */
export function useHealthData(): {
  days: DayRecord[];
  events: CalendarEvent[];
  eventsByDate: Map<string, DayEvents>;
  hasCalendar: boolean;
} {
  const rawDays = useApp((s) => s.days);
  const events = useApp((s) => s.calendarEvents);
  const days = useMemo(() => enrichDaysWithCalendar(rawDays, events), [rawDays, events]);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  return { days, events, eventsByDate, hasCalendar: events.length > 0 };
}
