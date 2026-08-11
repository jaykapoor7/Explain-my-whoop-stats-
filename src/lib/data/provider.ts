import { DailySummary } from "../types";

/**
 * Data source abstraction. The live implementation is the Fitbit Web API
 * (server routes under /api/fitbit/*, mapper in src/lib/fitbit/server.ts):
 * OAuth 2.0 PKCE public client — Client ID only, tokens in httpOnly cookies,
 * synced days returned to the browser and stored locally.
 *
 * Future providers (Apple Health, Garmin, WHOOP, Oura) implement the same
 * shape: fetch → map into DailySummary[] → merge into local state. No UI or
 * scoring code changes required.
 */
export interface WearableSyncResult {
  days: DailySummary[];
  count: number;
  syncedAt: string;
}

export async function syncWearable(): Promise<WearableSyncResult> {
  const res = await fetch("/api/fitbit/sync", { cache: "no-store" });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `sync_${res.status}`);
  }
  return (await res.json()) as WearableSyncResult;
}
