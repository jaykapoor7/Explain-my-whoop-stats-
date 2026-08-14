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
  manualDays: DailySummary[]; // hand-entered days (any wearable / no device)
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
  cloudUpdatedAt: number; // last time this state matched the cloud (0 = never)

  setSelectedDate: (d: string | null) => void;
  hydrateFromCloud: (data: Record<string, unknown>, updatedAt: number) => void;
  markCloudSynced: (updatedAt: number) => void;
  setWearableDays: (days: DailySummary[], syncedAt: string) => void;
  saveManualDay: (day: DailySummary) => void;
  removeManualDay: (date: string) => void;
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

/** Union two day lists by date (incoming wins), sorted, capped. */
function mergeByDate(a: DailySummary[], b: DailySummary[]): DailySummary[] {
  const m = new Map(a.map((d) => [d.date, d]));
  for (const d of b) m.set(d.date, d);
  return [...m.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-120);
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      wearableDays: [],
      manualDays: [],
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
      cloudUpdatedAt: 0,

      setSelectedDate: (d) => set({ selectedDate: d }),
      markCloudSynced: (updatedAt) => set({ cloudUpdatedAt: updatedAt }),
      hydrateFromCloud: (data, updatedAt) =>
        set((s) => {
          const d = data as Partial<AppState>;
          // Wearable days are the same Google-sourced truth on every device —
          // union by date so a fresh device never loses what it already pulled.
          const byDate = new Map<string, DailySummary>();
          for (const day of s.wearableDays) byDate.set(day.date, day);
          for (const day of (d.wearableDays ?? [])) byDate.set(day.date, day);
          const merged = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
          return {
            wearableDays: merged,
            lastSync: d.lastSync ?? s.lastSync,
            activityResolutions: d.activityResolutions ?? s.activityResolutions,
            activityTypeEdits: d.activityTypeEdits ?? s.activityTypeEdits,
            meals: d.meals ?? s.meals,
            medications: d.medications ?? s.medications,
            medOverrides: d.medOverrides ?? s.medOverrides,
            journal: d.journal ?? s.journal,
            tasks: d.tasks ?? s.tasks,
            taskDone: d.taskDone ?? s.taskDone,
            goalTargets: d.goalTargets ?? s.goalTargets,
            settings: { ...s.settings, ...(d.settings ?? {}) },
            manualDays: mergeByDate(s.manualDays, d.manualDays ?? []),
            cloudUpdatedAt: updatedAt,
          };
        }),
      setWearableDays: (incoming, syncedAt) =>
        set((s) => {
          // merge by date: new sync wins for wearable fields
          const map = new Map(s.wearableDays.map((d) => [d.date, d]));
          for (const d of incoming) map.set(d.date, d);
          return { wearableDays: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120), lastSync: syncedAt };
        }),
      saveManualDay: (day) =>
        set((s) => ({ manualDays: [...s.manualDays.filter((d) => d.date !== day.date), day].sort((a, b) => a.date.localeCompare(b.date)).slice(-120) })),
      removeManualDay: (date) => set((s) => ({ manualDays: s.manualDays.filter((d) => d.date !== date) })),
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
          manualDays: [],
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

/** Fields mirrored to the cloud snapshot for signed-in users. */
export const SYNC_KEYS = [
  "wearableDays", "manualDays", "lastSync", "activityResolutions", "activityTypeEdits",
  "meals", "medications", "medOverrides", "journal", "tasks", "taskDone",
  "goalTargets", "settings",
] as const;

export function collectSyncState(s: AppState): Record<string, unknown> {
  const src = s as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SYNC_KEYS) out[k] = src[k];
  return out;
}
