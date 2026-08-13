"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DailySummary, Goal, JournalEntry, Meal, Medication, MedStatus, PlannerTask } from "../types";

/**
 * Local app state. Wearable days come from Fitbit sync (stored here, on-device);
 * everything else is the user's own logging. Nothing leaves the browser.
 */

export interface Settings {
  name: string;
  weightUnit: "kg" | "lb";
  showLowConfidence: boolean;
  birthYear?: number; // for Health Age; optional
  whatsappNumber?: string; // digits incl. country code, for wa.me plan reminders
  browserReminders?: boolean; // fire local notifications for timed tasks while open
}

export const DEFAULT_GOALS: Goal[] = [
  { id: "g-cal", kind: "calories", label: "Daily calories", target: 2400, unit: "kcal", direction: "at-most", domain: "nutrition" },
  { id: "g-protein", kind: "protein", label: "Protein", target: 150, unit: "g", direction: "at-least", domain: "nutrition" },
  { id: "g-sleep", kind: "sleep", label: "Sleep", target: 480, unit: "min", direction: "at-least", domain: "sleep" },
  { id: "g-steps", kind: "steps", label: "Steps", target: 10000, unit: "steps", direction: "at-least", domain: "strain" },
  { id: "g-train", kind: "training", label: "Train 4× / week", target: 4, unit: "sessions", direction: "at-least", domain: "strain" },
  { id: "g-weight", kind: "weight", label: "Target weight", target: 76, unit: "kg", direction: "hit" },
];

interface AppState {
  wearableDays: DailySummary[];
  lastSync: string | null;
  activityResolutions: Record<string, "confirmed" | "ignored" | "edited">;
  activityTypeEdits: Record<string, string>;
  meals: Meal[];
  medications: Medication[];
  medOverrides: Record<string, { status: MedStatus; takenAt?: string }>;
  journal: Record<string, JournalEntry>;
  tasks: PlannerTask[];
  taskDone: Record<string, boolean>;
  goalTargets: Record<string, number>;
  settings: Settings;
  hydrated: boolean;
  selectedDate: string | null; // day being viewed (null = latest); ephemeral

  setSelectedDate: (d: string | null) => void;
  setWearableDays: (days: DailySummary[], syncedAt: string) => void;
  resolveActivity: (id: string, res: "confirmed" | "ignored" | "edited", newType?: string) => void;
  addMeal: (meal: Meal) => void;
  removeMeal: (id: string) => void;
  addMedication: (med: Medication) => void;
  removeMedication: (id: string) => void;
  setMedStatus: (eventId: string, status: MedStatus, takenAt?: string) => void;
  saveJournal: (entry: JournalEntry) => void;
  addTask: (task: PlannerTask) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string, done: boolean) => void;
  setGoalTarget: (goalId: string, target: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  setHydrated: () => void;
}

const DEFAULT_SETTINGS: Settings = { name: "You", weightUnit: "kg", showLowConfidence: true };

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      wearableDays: [],
      lastSync: null,
      activityResolutions: {},
      activityTypeEdits: {},
      meals: [],
      medications: [],
      medOverrides: {},
      journal: {},
      tasks: [],
      taskDone: {},
      goalTargets: {},
      settings: DEFAULT_SETTINGS,
      hydrated: false,
      selectedDate: null,

      setSelectedDate: (d) => set({ selectedDate: d }),
      setWearableDays: (incoming, syncedAt) =>
        set((s) => {
          // merge by date: new sync wins for wearable fields
          const map = new Map(s.wearableDays.map((d) => [d.date, d]));
          for (const d of incoming) map.set(d.date, d);
          return { wearableDays: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120), lastSync: syncedAt };
        }),
      resolveActivity: (id, res, newType) =>
        set((s) => ({
          activityResolutions: { ...s.activityResolutions, [id]: res },
          activityTypeEdits: newType ? { ...s.activityTypeEdits, [id]: newType } : s.activityTypeEdits,
        })),
      addMeal: (meal) => set((s) => ({ meals: [...s.meals, meal] })),
      removeMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
      addMedication: (med) => set((s) => ({ medications: [...s.medications, med] })),
      removeMedication: (id) => set((s) => ({ medications: s.medications.filter((m) => m.id !== id) })),
      setMedStatus: (eventId, status, takenAt) => set((s) => ({ medOverrides: { ...s.medOverrides, [eventId]: { status, takenAt } } })),
      saveJournal: (entry) => set((s) => ({ journal: { ...s.journal, [entry.date]: entry } })),
      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      toggleTask: (id, done) => set((s) => ({ taskDone: { ...s.taskDone, [id]: done } })),
      setGoalTarget: (goalId, target) => set((s) => ({ goalTargets: { ...s.goalTargets, [goalId]: target } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetAll: () =>
        set({
          wearableDays: [],
          lastSync: null,
          activityResolutions: {},
          activityTypeEdits: {},
          meals: [],
          medications: [],
          medOverrides: {},
          journal: {},
          tasks: [],
          taskDone: {},
          goalTargets: {},
          settings: DEFAULT_SETTINGS,
        }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "health-os",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ hydrated: _h, selectedDate: _sd, ...rest }) => {
        const out = { ...rest } as Record<string, unknown>;
        for (const k of Object.keys(out)) if (typeof out[k] === "function") delete out[k];
        return out;
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);

export function applyGoalTargets(goals: Goal[], targets: Record<string, number>): Goal[] {
  return goals.map((g) => (targets[g.id] !== undefined ? { ...g, target: targets[g.id] } : g));
}
