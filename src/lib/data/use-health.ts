"use client";

import { useMemo } from "react";
import { Goal, JournalEntry, Medication, MedicationEvent, Meal, NutritionTotals, PlannerTask } from "../types";
import { applyGoalTargets, DEFAULT_GOALS, useApp } from "./store";
import { computeScoredDays, nutritionTotals, ScoredDay } from "../scoring/engine";
import { generateInsights, Insight } from "../insights/insights";
import { todayISO } from "../format";

/**
 * Single read path: synced wearable days + the user's own logs merged into
 * scored days. With no wearable data yet, logging pages still work standalone.
 */

export function deriveMedEvents(meds: Medication[], date: string, overrides: Record<string, { status: MedicationEvent["status"]; takenAt?: string }>): MedicationEvent[] {
  const out: MedicationEvent[] = [];
  for (const med of meds) {
    if (med.startDate > date || (med.endDate && med.endDate < date)) continue;
    const times = med.frequency === "as-needed" ? [] : med.times.length ? med.times : ["08:00"];
    for (const time of times) {
      const id = `${date}-${med.id}-${time}`;
      const o = overrides[id];
      out.push({ id, medicationId: med.id, date, scheduled: time, status: o?.status ?? "pending", takenAt: o?.takenAt });
    }
    // as-needed doses only exist when logged
    if (med.frequency === "as-needed") {
      const id = `${date}-${med.id}-prn`;
      const o = overrides[id];
      if (o) out.push({ id, medicationId: med.id, date, scheduled: "", status: o.status, takenAt: o.takenAt });
    }
  }
  return out;
}

export interface HealthData {
  days: ScoredDay[];
  today?: ScoredDay; // the day being viewed (latest unless a past day is selected)
  viewDate?: string; // ISO of the viewed day
  isLatest: boolean; // viewing the most recent synced day
  connected: boolean; // has any wearable data
  lastSync: string | null;
  insights: Insight[];
  goals: Goal[];
  tasks: PlannerTask[];
  medications: Medication[];
  todayMeals: Meal[];
  todayTotals: NutritionTotals;
  todayMedEvents: MedicationEvent[];
  todayJournal?: JournalEntry;
  hydrated: boolean;
}

export function useHealth(): HealthData {
  const s = useApp();
  const tISO = todayISO();

  const days = useMemo<ScoredDay[]>(() => {
    // Combine hand-entered days with synced days (a real sync wins per date),
    // so any wearable — or manual entry — produces scores.
    const byDate = new Map<string, (typeof s.wearableDays)[number]>();
    for (const d of s.manualDays) byDate.set(d.date, d);
    for (const d of s.wearableDays) byDate.set(d.date, d);
    const base = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (!base.length) return [];
    const merged = base.map((d) => ({
      ...d,
      activities: d.activities.map((a) => {
        const res = s.activityResolutions[a.id];
        const type = s.activityTypeEdits[a.id];
        return res || type ? { ...a, resolved: res, type: type ?? a.type } : a;
      }),
      meals: s.meals.filter((m) => m.date === d.date),
      medicationEvents: deriveMedEvents(s.medications, d.date, s.medOverrides),
      journal: s.journal[d.date],
    }));
    return computeScoredDays(merged);
  }, [s.wearableDays, s.manualDays, s.activityResolutions, s.activityTypeEdits, s.meals, s.medications, s.medOverrides, s.journal]);

  const insights = useMemo(() => generateInsights(days), [days]);
  const goals = useMemo(() => applyGoalTargets(DEFAULT_GOALS, s.goalTargets), [s.goalTargets]);
  const tasks = useMemo(
    () => s.tasks.map((t) => (s.taskDone[t.id] !== undefined ? { ...t, done: s.taskDone[t.id] } : t)),
    [s.tasks, s.taskDone]
  );

  const todayMeals = useMemo(() => s.meals.filter((m) => m.date === tISO), [s.meals, tISO]);
  const todayTotals = useMemo(
    () => nutritionTotals({ meals: todayMeals } as Parameters<typeof nutritionTotals>[0]),
    [todayMeals]
  );
  const todayMedEvents = useMemo(() => deriveMedEvents(s.medications, tISO, s.medOverrides), [s.medications, s.medOverrides, tISO]);

  const last = days[days.length - 1];
  // The viewed day: the selected date if it's a real synced day, else the latest.
  const viewed = (s.selectedDate && days.find((d) => d.day.date === s.selectedDate)) || last;
  const isLatest = !viewed || !last || viewed.day.date === last.day.date;
  return {
    days,
    today: viewed,
    viewDate: viewed?.day.date,
    isLatest,
    connected: s.wearableDays.length > 0 || s.manualDays.length > 0,
    lastSync: s.lastSync,
    insights,
    goals,
    tasks,
    medications: s.medications,
    todayMeals,
    todayTotals,
    todayMedEvents,
    todayJournal: s.journal[tISO],
    hydrated: s.hydrated,
  };
}
