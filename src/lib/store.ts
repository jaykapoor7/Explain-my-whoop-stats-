"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CalendarEvent, ChatMessage, DatasetMeta, DayRecord, Experiment } from "./types";
import { generateDemoData } from "./demo-data";
import { generateDemoCalendar } from "./calendar/demo-calendar";

export interface CalendarMeta {
  source: string; // "Google Calendar", "Apple Calendar", "Demo calendar", ...
  fileNames: string[];
  importedAt: string;
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
  experiments: Experiment[];
  chat: ChatMessage[];
  hydrated: boolean;

  loadDemo: () => void;
  setData: (days: DayRecord[], meta: DatasetMeta) => void;
  setCalendar: (events: CalendarEvent[], meta: CalendarMeta) => void;
  clearCalendar: () => void;
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
      setCalendar: (calendarEvents, calendarMeta) => set({ calendarEvents, calendarMeta }),
      clearCalendar: () => set({ calendarEvents: [], calendarMeta: null }),
      clearAll: () =>
        set({ days: [], meta: null, calendarEvents: [], calendarMeta: null, experiments: [], chat: [] }),
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
        experiments: s.experiments,
        chat: s.chat,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);
