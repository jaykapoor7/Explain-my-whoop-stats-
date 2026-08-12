"use client";

import { useCallback, useEffect, useRef } from "react";
import { useApp } from "@/lib/data/store";
import { syncWearable } from "@/lib/data/provider";

/**
 * Keeps wearable data fresh automatically while the app is open — no manual
 * "Sync now" needed. Syncs on load, when the tab regains focus, and on an
 * interval, throttled so it never hammers the API. (True background sync while
 * the app is closed isn't possible for a browser app with no server-side
 * storage — the data and tokens live in this browser.)
 */
const THROTTLE_MS = 8 * 60 * 1000; // at most once per 8 minutes
const INTERVAL_MS = 15 * 60 * 1000; // periodic refresh while open

export function AutoSync() {
  const setWearableDays = useApp((s) => s.setWearableDays);
  const hydrated = useApp((s) => s.hydrated);
  const busy = useRef(false);
  const lastRun = useRef(0);
  const connected = useRef<boolean | null>(null);

  const run = useCallback(
    async (force = false) => {
      if (busy.current) return;
      if (!force && Date.now() - lastRun.current < THROTTLE_MS) return;
      // Resolve connection state (re-check while not yet connected).
      if (!connected.current) {
        try {
          const r = await fetch("/api/fitbit/status", { cache: "no-store" });
          connected.current = Boolean((await r.json())?.connected);
        } catch {
          connected.current = false;
        }
      }
      if (!connected.current) return;
      busy.current = true;
      try {
        const r = await syncWearable();
        if (r.count) setWearableDays(r.days, r.syncedAt);
        lastRun.current = Date.now();
      } catch (e) {
        if (String(e).includes("not_connected")) connected.current = false; // token gone
      } finally {
        busy.current = false;
      }
    },
    [setWearableDays]
  );

  useEffect(() => {
    if (!hydrated) return;
    run();
    const iv = setInterval(() => run(), INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrated, run]);

  return null;
}
