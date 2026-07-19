/**
 * Client-safe connection registry — metadata only, no secrets. The server
 * config (client id/secret, token URLs) lives in ./server/config.ts and is
 * never imported by client code.
 */

export type ConnectionMethod = "oauth" | "export";

export interface ProviderInfo {
  id: string;
  name: string;
  method: ConnectionMethod;
  color: string;
  /** what data this connection pulls */
  provides: string;
  /** short setup / availability note shown in the UI */
  note: string;
  /** provider developer console, for the setup instructions */
  devConsole?: string;
  /** OAuth scopes requested (for transparency in the UI) */
  scopes?: string;
}

export const OAUTH_PROVIDERS: ProviderInfo[] = [
  {
    id: "whoop",
    name: "WHOOP",
    method: "oauth",
    color: "#34d399",
    provides: "Recovery, HRV, resting HR, sleep stages, day strain, workouts",
    note: "Connect your WHOOP account and auto-sync every visit.",
    devConsole: "https://developer.whoop.com",
    scopes: "recovery · sleep · workouts · cycles · profile",
  },
  {
    id: "oura",
    name: "Oura",
    method: "oauth",
    color: "#7c6bff",
    provides: "Readiness, HRV, resting HR, sleep, activity, workouts",
    note: "Connect your Oura ring and auto-sync every visit.",
    devConsole: "https://cloud.ouraring.com/oauth/applications",
    scopes: "daily · heartrate · workout · personal",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    method: "oauth",
    color: "#2dd4ee",
    provides: "Resting HR, HRV, sleep stages, steps, calories",
    note: "Connect your Fitbit account and auto-sync every visit.",
    devConsole: "https://dev.fitbit.com/apps",
    scopes: "heartrate · sleep · activity · profile",
  },
];

/** Sources a browser app can't sync directly — export/upload only. */
export const EXPORT_PROVIDERS: ProviderInfo[] = [
  {
    id: "apple-health",
    name: "Apple Health",
    method: "export",
    color: "#fb7185",
    provides: "Everything on your iPhone/Watch",
    note: "Apple Health is only reachable by native iOS apps (HealthKit). Export from the Health app and upload the XML/ZIP.",
  },
  {
    id: "bevel",
    name: "Bevel",
    method: "export",
    color: "#a78bfa",
    provides: "HRV, recovery, sleep",
    note: "No third-party cloud API. Export your data from Bevel and upload the file — it's parsed automatically.",
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    method: "export",
    color: "#4d9fff",
    provides: "HR, sleep, activities, training load",
    note: "Garmin's API is approval-gated. Export CSVs from Garmin Connect and upload them.",
  },
];

export function providerInfo(id: string): ProviderInfo | undefined {
  return [...OAUTH_PROVIDERS, ...EXPORT_PROVIDERS].find((p) => p.id === id);
}

export interface ConnectionStatus {
  id: string;
  configured: boolean; // server has client id/secret env vars
  connected: boolean; // a valid token cookie exists
}
