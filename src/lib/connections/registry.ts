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
  // ---- in-app connect hints ----
  /** OAuth needs a client secret (else it's a public / PKCE client). */
  secretRequired?: boolean;
  /** provider supports a pasteable personal access token (simplest path). */
  supportsPat?: boolean;
  /** where to generate a personal access token */
  patUrl?: string;
  /** one-line instruction for getting the credentials */
  credHint?: string;
}

export const OAUTH_PROVIDERS: ProviderInfo[] = [
  {
    id: "oura",
    name: "Oura",
    method: "oauth",
    color: "#7c6bff",
    provides: "Readiness, HRV, resting HR, sleep, activity, workouts",
    note: "Easiest: paste a Personal Access Token — no app to register.",
    devConsole: "https://cloud.ouraring.com/oauth/applications",
    scopes: "daily · heartrate · workout · personal",
    secretRequired: true,
    supportsPat: true,
    patUrl: "https://cloud.ouraring.com/personal-access-tokens",
    credHint: "Generate a token in seconds — no OAuth app needed.",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    method: "oauth",
    color: "#2dd4ee",
    provides: "Resting HR, HRV, sleep stages, steps, calories",
    note: "Just paste a Client ID — no secret, no Vercel setup.",
    devConsole: "https://dev.fitbit.com/apps",
    scopes: "heartrate · sleep · activity · profile",
    secretRequired: false,
    credHint: "Register a free 'Personal' app (OAuth type: Client) and copy its Client ID.",
  },
  {
    id: "whoop",
    name: "WHOOP",
    method: "oauth",
    color: "#34d399",
    provides: "Recovery, HRV, resting HR, sleep stages, day strain, workouts",
    note: "Paste your app's Client ID + Secret once — right here, no env vars.",
    devConsole: "https://developer.whoop.com",
    scopes: "recovery · sleep · workouts · cycles · profile",
    secretRequired: true,
    credHint: "Create an app, set the redirect URL shown below, then copy its Client ID + Secret.",
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
  configured: boolean; // OAuth is ready to run (credentials present)
  hasClientId: boolean; // a client id has been saved (env or in-app)
  connected: boolean; // a valid token/PAT cookie exists
}
