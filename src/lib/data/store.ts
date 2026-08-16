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
  sex?: "male" | "female" | "other"; // optional, refines energy/calorie estimates
  heightCm?: number; // optional profile detail
  whatsappNumber?: string; // digits incl. country code, for wa.me plan reminders
  browserReminders?: boolean; // fire local notifications for timed tasks while open
  wakeTime?: string; // preferred wake time "HH:MM" (24h) for the sleep coach
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
  // Tombstones: id -> deletedAt (ms). Because logged data is union-merged across
  // devices, a plain delete can't stick — the next cloud pull re-adds anything the
  // server still holds. Deleted ids are recorded here, excluded from every union,
  // and synced, so a deletion propagates instead of resurrecting. Covers tasks,
  // meals and medications (the id-keyed lists).
  deletedIds: Record<string, number>;
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

/** Union two id-keyed lists (incoming wins on conflict, but nothing is lost).
 * This is what lets a planner task added on your laptop survive a sync from a
 * phone that never had it — the two lists merge instead of overwriting. */
function unionById<T extends { id: string }>(local: T[], cloud: T[] = []): T[] {
  const m = new Map(local.map((x) => [x.id, x]));
  for (const x of cloud) m.set(x.id, x);
  return [...m.values()];
}
/** Merge two plain maps (incoming wins per key; both keys survive). */
function mergeMap<V>(local: Record<string, V>, cloud: Record<string, V> = {}): Record<string, V> {
  return { ...local, ...cloud };
}

/** Tombstones live ~120 days — long enough for every device to sync the delete,
 * short enough that the set can't grow without bound. */
const TOMBSTONE_TTL_MS = 120 * 24 * 60 * 60 * 1000;

/** Union two tombstone maps, keeping the later deletedAt, dropping expired ones. */
function mergeTombstones(local: Record<string, number> = {}, cloud: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  for (const [id, ts] of [...Object.entries(local), ...Object.entries(cloud)]) {
    if (ts < cutoff) continue;
    if (out[id] === undefined || ts > out[id]) out[id] = ts;
  }
  return out;
}

/** Drop any id-keyed rows that have been tombstoned — a delete beats a stale add. */
function dropDeleted<T extends { id: string }>(rows: T[], deleted: Record<string, number>): T[] {
  return rows.filter((r) => deleted[r.id] === undefined);
}

/** Re-adding an id (e.g. an undo) lifts its tombstone so the add isn't dropped. */
function clearTombstone(deleted: Record<string, number>, id: string): Record<string, number> {
  if (deleted[id] === undefined) return deleted;
  const rest = { ...deleted };
  delete rest[id];
  return rest;
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
      deletedIds: {},
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
          // Everything the user logs is UNION-merged, never replaced — so a
          // device syncing its state can only add to the cloud, never wipe what
          // another device wrote (tasks, meals, journal, meds all survive).
          // Merge tombstones from both sides first, then apply them to every
          // id-keyed union so a delete made on any device wins over a stale copy
          // the server (or another device) still holds.
          const deletedIds = mergeTombstones(s.deletedIds, d.deletedIds as Record<string, number> | undefined);
          return {
            wearableDays: merged,
            lastSync: d.lastSync ?? s.lastSync,
            activityResolutions: mergeMap(s.activityResolutions, d.activityResolutions),
            activityTypeEdits: mergeMap(s.activityTypeEdits, d.activityTypeEdits),
            meals: dropDeleted(unionById(s.meals, d.meals), deletedIds),
            medications: dropDeleted(unionById(s.medications, d.medications), deletedIds),
            medOverrides: mergeMap(s.medOverrides, d.medOverrides),
            journal: mergeMap(s.journal, d.journal),
            tasks: dropDeleted(unionById(s.tasks, d.tasks), deletedIds),
            taskDone: mergeMap(s.taskDone, d.taskDone),
            goalTargets: mergeMap(s.goalTargets, d.goalTargets),
            deletedIds,
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
      addMeal: (meal) => set((s) => ({ meals: [...s.meals, meal], deletedIds: clearTombstone(s.deletedIds, meal.id) })),
      removeMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id), deletedIds: { ...s.deletedIds, [id]: Date.now() } })),
      addMedication: (med) => set((s) => ({ medications: [...s.medications, med], deletedIds: clearTombstone(s.deletedIds, med.id) })),
      removeMedication: (id) => set((s) => ({ medications: s.medications.filter((m) => m.id !== id), deletedIds: { ...s.deletedIds, [id]: Date.now() } })),
      setMedStatus: (eventId, status, takenAt) => set((s) => ({ medOverrides: { ...s.medOverrides, [eventId]: { status, takenAt } } })),
      saveJournal: (entry) => set((s) => ({ journal: { ...s.journal, [entry.date]: entry } })),
      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task], deletedIds: clearTombstone(s.deletedIds, task.id) })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), deletedIds: { ...s.deletedIds, [id]: Date.now() } })),
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
          deletedIds: {},
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
  "goalTargets", "deletedIds", "settings",
] as const;

export function collectSyncState(s: AppState): Record<string, unknown> {
  const src = s as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SYNC_KEYS) out[k] = src[k];
  return out;
}
