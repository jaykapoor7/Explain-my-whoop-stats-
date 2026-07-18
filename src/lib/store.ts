"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ChatMessage, DatasetMeta, DayRecord, Experiment } from "./types";
import { generateDemoData } from "./demo-data";

/**
 * All health data lives client-side (localStorage) — processing happens in
 * the browser, nothing is uploaded to a server. This is the privacy model.
 */

interface AppState {
  days: DayRecord[];
  meta: DatasetMeta | null;
  experiments: Experiment[];
  chat: ChatMessage[];
  hydrated: boolean;

  loadDemo: () => void;
  setData: (days: DayRecord[], meta: DatasetMeta) => void;
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
      experiments: [],
      chat: [],
      hydrated: false,

      loadDemo: () =>
        set({
          days: generateDemoData(),
          meta: {
            source: "Demo dataset",
            fileNames: ["demo-6-months.generated"],
            importedAt: new Date().toISOString(),
          },
        }),
      setData: (days, meta) => set({ days, meta }),
      clearAll: () => set({ days: [], meta: null, experiments: [], chat: [] }),
      addExperiment: (exp) => set((s) => ({ experiments: [...s.experiments, exp] })),
      removeExperiment: (id) => set((s) => ({ experiments: s.experiments.filter((e) => e.id !== id) })),
      addChatMessage: (msg) => set((s) => ({ chat: [...s.chat, msg] })),
      clearChat: () => set({ chat: [] }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "recovery-intelligence",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ days: s.days, meta: s.meta, experiments: s.experiments, chat: s.chat }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);
