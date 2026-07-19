"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CalendarEvent, ChatMessage, DatasetMeta, DayRecord, Experiment, FoodEntry, NutritionGoals } from "./types";
import { generateDemoData } from "./demo-data";
import { generateDemoCalendar } from "./calendar/demo-calendar";
import { mergeDays } from "./merge";
import { DEFAULT_GOALS } from "./nutrition/nutrition";

export interface CalendarMeta {
  source: string; // "Google Calendar", "Apple Calendar", "Demo calendar", ...
  fileNames: string[];
  importedAt: string;
}

export interface SyncedSource {
  provider: string; // "whoop" | "oura" | "fitbit" | "demo"
  label: string; // "WHOOP", "Oura", ...
  lastSync: string; // ISO
  dayCount: number; // days contributed on the last sync
}

/**
 * All health data lives client-side (localStorage) — processing happens in
 * the browser, nothing is uploaded to a server. This is the privacy model.
 */

interface AppState {
  days: DayRecord[];
  meta: DatasetMeta | null;
  calendarEvents: CalendarEvent[];
  calendarMeta: CalendarMeta | null;
  syncedSources: SyncedSource[];
  foodLog: FoodEntry[];
  nutritionGoals: NutritionGoals;
  experiments: Experiment[];
  chat: ChatMessage[];
  hydrated: boolean;

  loadDemo: () => void;
  setData: (days: DayRecord[], meta: DatasetMeta) => void;
  mergeSynced: (days: DayRecord[], provider: string, label: string) => number;
  setCalendar: (events: CalendarEvent[], meta: CalendarMeta) => void;
  clearCalendar: () => void;
  addFood: (entry: FoodEntry) => void;
  updateFoodServings: (id: string, servings: number) => void;
  removeFood: (id: string) => void;
  setNutritionGoals: (goals: NutritionGoals) => void;
  clearAll: () => void;
  addExperiment: (exp: Experiment) => void;
  removeExperiment: (id: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  setHydrated: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      days: [],
      meta: null,
      calendarEvents: [],
      calendarMeta: null,
      syncedSources: [],
      foodLog: [],
      nutritionGoals: DEFAULT_GOALS,
      experiments: [],
      chat: [],
      hydrated: false,

      loadDemo: () => {
        const days = generateDemoData();
        set({
          days,
          meta: {
            source: "Demo dataset",
            fileNames: ["demo-6-months.generated"],
            importedAt: new Date().toISOString(),
          },
          calendarEvents: generateDemoCalendar(days),
          calendarMeta: {
            source: "Demo calendar",
            fileNames: ["work-life.generated.ics"],
            importedAt: new Date().toISOString(),
          },
        });
      },
      setData: (days, meta) => set({ days, meta }),
      mergeSynced: (incoming, provider, label) => {
        let added = 0;
        set((s) => {
          const merged = mergeDays(s.days, incoming);
          added = merged.length - s.days.length;
          const others = s.syncedSources.filter((x) => x.provider !== provider);
          const meta: DatasetMeta =
            s.meta ?? { source: label, fileNames: [], importedAt: new Date().toISOString() };
          const sources = meta.source
            .split(" + ")
            .filter((x) => x && x !== "No data");
          if (!sources.includes(label)) sources.push(label);
          return {
            days: merged,
            meta: { ...meta, source: sources.join(" + ") },
            syncedSources: [
              ...others,
              { provider, label, lastSync: new Date().toISOString(), dayCount: incoming.length },
            ],
          };
        });
        return added;
      },
      setCalendar: (calendarEvents, calendarMeta) => set({ calendarEvents, calendarMeta }),
      clearCalendar: () => set({ calendarEvents: [], calendarMeta: null }),
      addFood: (entry) => set((s) => ({ foodLog: [...s.foodLog, entry] })),
      updateFoodServings: (id, servings) =>
        set((s) => ({
          foodLog: s.foodLog.map((e) => (e.id === id ? { ...e, servings: Math.max(0.25, servings) } : e)),
        })),
      removeFood: (id) => set((s) => ({ foodLog: s.foodLog.filter((e) => e.id !== id) })),
      setNutritionGoals: (nutritionGoals) => set({ nutritionGoals }),
      clearAll: () =>
        set({
          days: [],
          meta: null,
          calendarEvents: [],
          calendarMeta: null,
          syncedSources: [],
          foodLog: [],
          experiments: [],
          chat: [],
        }),
      addExperiment: (exp) => set((s) => ({ experiments: [...s.experiments, exp] })),
      removeExperiment: (id) => set((s) => ({ experiments: s.experiments.filter((e) => e.id !== id) })),
      addChatMessage: (msg) => set((s) => ({ chat: [...s.chat, msg] })),
      clearChat: () => set({ chat: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "recovery-intelligence",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        days: s.days,
        meta: s.meta,
        calendarEvents: s.calendarEvents,
        calendarMeta: s.calendarMeta,
        syncedSources: s.syncedSources,
        foodLog: s.foodLog,
        nutritionGoals: s.nutritionGoals,
        experiments: s.experiments,
        chat: s.chat,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);
