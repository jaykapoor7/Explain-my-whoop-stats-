"use client";

import { useMemo } from "react";
import { Dataset, Goal, PlannerTask } from "../types";
import { getMockDataset } from "./provider";
import { applyGoalTargets, useOverlay } from "./store";
import { computeScoredDays, ScoredDay } from "../scoring/engine";
import { generateInsights, Insight } from "../insights/insights";

/**
 * The single read path for every page: deterministic mock dataset + user
 * overlays -> scored days -> insights. Memoized so score computation runs
 * once per overlay change.
 */
export interface HealthData {
  dataset: Dataset;
  days: ScoredDay[];
  today: ScoredDay;
  yesterday?: ScoredDay;
  insights: Insight[];
  goals: Goal[];
  tasks: PlannerTask[];
  hydrated: boolean;
}

export function useHealth(): HealthData {
  const overlay = useOverlay();

  const merged = useMemo<Dataset>(() => {
    const base = getMockDataset();
    const days = base.days.map((d) => {
      const activities = d.activities.map((a) => {
        const res = overlay.activityResolutions[a.id];
        const type = overlay.activityTypeEdits[a.id];
        return res || type ? { ...a, resolved: res ?? a.resolved, type: type ?? a.type } : a;
      });
      const extraMeals = overlay.addedMeals.filter((m) => m.date === d.date);
      const medicationEvents = d.medicationEvents.map((e) => {
        const o = overlay.medOverrides[e.id];
        return o ? { ...e, status: o.status, takenAt: o.takenAt ?? e.takenAt } : e;
      });
      const journal = overlay.journalOverrides[d.date] ?? d.journal;
      return {
        ...d,
        activities,
        meals: extraMeals.length ? [...d.meals, ...extraMeals] : d.meals,
        medicationEvents,
        journal,
      };
    });
    return { ...base, days };
  }, [overlay.activityResolutions, overlay.activityTypeEdits, overlay.addedMeals, overlay.medOverrides, overlay.journalOverrides]);

  const days = useMemo(() => computeScoredDays(merged.days), [merged]);
  const insights = useMemo(() => generateInsights(days), [days]);

  const tasks = useMemo<PlannerTask[]>(() => {
    const all = [...merged.planner, ...overlay.addedTasks];
    return all.map((t) => (overlay.taskDone[t.id] !== undefined ? { ...t, done: overlay.taskDone[t.id] } : t));
  }, [merged, overlay.addedTasks, overlay.taskDone]);

  const goals = useMemo(() => applyGoalTargets(merged.goals, overlay.goalTargets), [merged, overlay.goalTargets]);

  return {
    dataset: merged,
    days,
    today: days[days.length - 1],
    yesterday: days[days.length - 2],
    insights,
    goals,
    tasks,
    hydrated: overlay.hydrated,
  };
}
