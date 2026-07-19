"use client";

import { useMemo } from "react";
import { useApp } from "./store";
import { enrichDaysWithCalendar, groupEventsByDate, DayEvents } from "./calendar/features";
import { enrichDaysWithNutrition } from "./nutrition/nutrition";
import { CalendarEvent, DayRecord } from "./types";

/**
 * Single read-path for pages: days with logged nutrition and calendar context
 * materialized as ordinary metrics, so every analysis surface sees the same
 * enriched view.
 */
export function useHealthData(): {
  days: DayRecord[];
  events: CalendarEvent[];
  eventsByDate: Map<string, DayEvents>;
  hasCalendar: boolean;
} {
  const rawDays = useApp((s) => s.days);
  const events = useApp((s) => s.calendarEvents);
  const foodLog = useApp((s) => s.foodLog);
  const days = useMemo(
    () => enrichDaysWithCalendar(enrichDaysWithNutrition(rawDays, foodLog), events),
    [rawDays, foodLog, events]
  );
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  return { days, events, eventsByDate, hasCalendar: events.length > 0 };
}
