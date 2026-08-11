"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Goal, JournalEntry, Meal, MedStatus, PlannerTask } from "../types";

/**
 * User-state store. The mock dataset itself is deterministic and regenerated
 * on load; this store persists only the user's own actions, which are merged
 * over the dataset at read time (see useHealthData). That keeps localStorage
 * tiny and the mock reproducible.
 */

export interface Settings {
  name: string;
  weightUnit: "kg" | "lb";
  dayStartHour: number;
  showLowConfidence: boolean;
}

interface OverlayState {
  /** activity id -> resolution for low-confidence blocks */
  activityResolutions: Record<string, "confirmed" | "ignored" | "edited">;
  /** activity id -> new type label when edited */
  activityTypeEdits: Record<string, string>;
  /** meals the user logged on top of the mock day */
  addedMeals: Meal[];
  /** medication event id -> user-set status */
  medOverrides: Record<string, { status: MedStatus; takenAt?: string }>;
  /** date -> journal entry replacing the mock one */
  journalOverrides: Record<string, JournalEntry>;
  /** planner tasks added by the user */
  addedTasks: PlannerTask[];
  /** task id -> done override (covers mock + added tasks) */
  taskDone: Record<string, boolean>;
  /** goal id -> new target */
  goalTargets: Record<string, number>;
  settings: Settings;
  hydrated: boolean;

  resolveActivity: (id: string, res: "confirmed" | "ignored" | "edited", newType?: string) => void;
  addMeal: (meal: Meal) => void;
  removeAddedMeal: (id: string) => void;
  setMedStatus: (eventId: string, status: MedStatus, takenAt?: string) => void;
  saveJournal: (entry: JournalEntry) => void;
  addTask: (task: PlannerTask) => void;
  removeAddedTask: (id: string) => void;
  toggleTask: (id: string, done: boolean) => void;
  setGoalTarget: (goalId: string, target: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  setHydrated: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  name: "You",
  weightUnit: "kg",
  dayStartHour: 4,
  showLowConfidence: true,
};

export const useOverlay = create<OverlayState>()(
  persist(
    (set) => ({
      activityResolutions: {},
      activityTypeEdits: {},
      addedMeals: [],
      medOverrides: {},
      journalOverrides: {},
      addedTasks: [],
      taskDone: {},
      goalTargets: {},
      settings: DEFAULT_SETTINGS,
      hydrated: false,

      resolveActivity: (id, res, newType) =>
        set((s) => ({
          activityResolutions: { ...s.activityResolutions, [id]: res },
          activityTypeEdits: newType ? { ...s.activityTypeEdits, [id]: newType } : s.activityTypeEdits,
        })),
      addMeal: (meal) => set((s) => ({ addedMeals: [...s.addedMeals, meal] })),
      removeAddedMeal: (id) => set((s) => ({ addedMeals: s.addedMeals.filter((m) => m.id !== id) })),
      setMedStatus: (eventId, status, takenAt) =>
        set((s) => ({ medOverrides: { ...s.medOverrides, [eventId]: { status, takenAt } } })),
      saveJournal: (entry) => set((s) => ({ journalOverrides: { ...s.journalOverrides, [entry.date]: entry } })),
      addTask: (task) => set((s) => ({ addedTasks: [...s.addedTasks, task] })),
      removeAddedTask: (id) => set((s) => ({ addedTasks: s.addedTasks.filter((t) => t.id !== id) })),
      toggleTask: (id, done) => set((s) => ({ taskDone: { ...s.taskDone, [id]: done } })),
      setGoalTarget: (goalId, target) => set((s) => ({ goalTargets: { ...s.goalTargets, [goalId]: target } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetAll: () =>
        set({
          activityResolutions: {},
          activityTypeEdits: {},
          addedMeals: [],
          medOverrides: {},
          journalOverrides: {},
          addedTasks: [],
          taskDone: {},
          goalTargets: {},
          settings: DEFAULT_SETTINGS,
        }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "health-os",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activityResolutions: s.activityResolutions,
        activityTypeEdits: s.activityTypeEdits,
        addedMeals: s.addedMeals,
        medOverrides: s.medOverrides,
        journalOverrides: s.journalOverrides,
        addedTasks: s.addedTasks,
        taskDone: s.taskDone,
        goalTargets: s.goalTargets,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);

export function applyGoalTargets(goals: Goal[], targets: Record<string, number>): Goal[] {
  return goals.map((g) => (targets[g.id] !== undefined ? { ...g, target: targets[g.id] } : g));
}
