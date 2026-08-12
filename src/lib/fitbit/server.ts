import "server-only";
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { DailySummary, SleepSession } from "../types";
import { mapCaloriesRollup, mapExercise, mapHrv, mapRhr, mapSleep, mapStepsRollup, mapWeight } from "./map";

/**
 * Google Health API integration — the successor to the legacy Fitbit Web API
 * (legacy endpoints deprecate September 2026). Covers Fitbit Air data.
 *
 * Doc-verified specifics:
 * - App registration: Google Cloud console, enable the Google Health API,
 *   OAuth consent screen with googlehealth.* scopes (all classified
 *   RESTRICTED — production requires Google's review; Testing mode with
 *   test users works before verification).
 * - OAuth 2.0: standard Google endpoints. Authorization:
 *   https://accounts.google.com/o/oauth2/v2/auth with response_type=code,
 *   access_type=offline (+ prompt=consent to guarantee a refresh token).
 *   Token exchange/refresh: https://oauth2.googleapis.com/token (web
 *   application clients authenticate with client_id + client_secret).
 * - Data API: https://health.googleapis.com/v4/users/me/dataTypes/{type}/
 *   dataPoints:{list|rollUp|dailyRollUp|reconcile}. Rollup ranges capped at
 *   14 days for heart-rate/total-calories/active-minutes/
 *   calories-in-heart-rate-zone, 90 days otherwise.
 *
 * Tokens live in httpOnly cookies; synced data is returned to the browser
 * and stored locally. Nothing is persisted server-side.
 */

export const COOKIES = {
  client: "hos_gh_client",
  token: "hos_gh_token",
  state: "hos_gh_state",
  verifier: "hos_gh_verifier",
};

export interface ClientCreds {
  id: string;
  secret?: string;
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomToken = (n = 32) => b64url(crypto.randomBytes(n));

export function pkcePair() {
  const verifier = randomToken(48);
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** Read scopes for activity/sleep + weight (googlehealth.* — all Restricted). */
export const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
].join(" ");

export const encodeCreds = (c: ClientCreds) => Buffer.from(JSON.stringify(c)).toString("base64");
function decodeCreds(raw?: string): ClientCreds | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as ClientCreds;
    return c.id ? c : null;
  } catch {
    return null;
  }
}

export function creds(req: NextRequest): ClientCreds | null {
  if (process.env.GOOGLE_CLIENT_ID) {
    return { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
  }
  return decodeCreds(req.cookies.get(COOKIES.client)?.value);
}

export function redirectUri(origin: string): string {
  return `${(process.env.APP_URL ?? origin).replace(/\/$/, "")}/api/fitbit/callback`;
}

export function authorizeUrl(clientId: string, redirect: string, state: string, challenge: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirect,
    scope: SCOPES,
    state,
    access_type: "offline",
    prompt: "consent", // guarantees a refresh_token on this grant
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: URLSearchParams, previousRefresh?: string): Promise<TokenSet> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token endpoint ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    access_token: j.access_token,
    // Google only returns refresh_token on the initial consent grant.
    refresh_token: j.refresh_token ?? previousRefresh ?? "",
    expires_at: Date.now() + (j.expires_in - 60) * 1000,
  };
}

export function exchangeCode(c: ClientCreds, code: string, redirect: string, verifier: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: c.id,
    redirect_uri: redirect,
    code_verifier: verifier,
  });
  if (c.secret) body.set("client_secret", c.secret);
  return tokenRequest(body);
}

export function refreshToken(c: ClientCreds, refresh: string): Promise<TokenSet> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: c.id });
  if (c.secret) body.set("client_secret", c.secret);
  return tokenRequest(body, refresh);
}

export const encodeToken = (t: TokenSet) => Buffer.from(JSON.stringify(t)).toString("base64");
export function decodeToken(raw?: string): TokenSet | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as TokenSet;
    return t.access_token ? t : null;
  } catch {
    return null;
  }
}

// ---------------- Google Health API data fetch + mapping ----------------

const BASE = "https://health.googleapis.com/v4/users/me";

type Json = Record<string, unknown>;

async function api(path: string, token: string, body?: Json): Promise<Json | null> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Json;
}

/** GET list of raw data points for a type, filtered to [startIso, endIso] physical time. */
async function listPoints(type: string, token: string, startIso: string, endIso: string): Promise<Json[]> {
  const filter = encodeURIComponent(
    `${camel(type)}.sample_time.physical_time >= "${startIso}" AND ${camel(type)}.sample_time.physical_time < "${endIso}"`
  );
  const out: Json[] = [];
  let pageToken = "";
  for (let page = 0; page < 6; page++) {
    const qs = `?filter=${filter}&pageSize=500${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const j = await api(`/dataTypes/${type}/dataPoints${qs}`, token);
    if (!j) {
      // Some deployments reject the filter grammar — fall back to unfiltered page.
      if (page === 0) {
        const plain = await api(`/dataTypes/${type}/dataPoints?pageSize=500`, token);
        return (plain?.dataPoints as Json[]) ?? [];
      }
      break;
    }
    out.push(...(((j.dataPoints as Json[]) ?? [])));
    pageToken = (j.nextPageToken as string) ?? "";
    if (!pageToken) break;
  }
  return out;
}

// ---------------- Raw connection inspector ----------------
// Calls each data type with no field mapping and reports the real HTTP
// status + the actual field names Google returns, so a broken connection
// (401/403/scope) can be told apart from a field-mapping gap, and the
// mapping can be corrected against the true response shape.

export interface RawProbe {
  type: string;
  status: number;
  ok: boolean;
  count: number;
  sampleKeys: string[];
  sample?: unknown;
  note?: string;
}

const PROBE_TYPES = [
  "sleep",
  "exercise",
  "daily-resting-heart-rate",
  "daily-heart-rate-variability",
  "steps",
  "total-calories",
  "weight",
];

function collectKeys(obj: unknown, prefix = "", depth = 0): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || depth > 2) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Json)) {
    keys.push(prefix + k);
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...collectKeys(v, `${prefix}${k}.`, depth + 1));
  }
  return keys;
}

function summarize(probe: RawProbe, j: Json | null, text: string, ok: boolean) {
  if (!j) {
    probe.note = text.slice(0, 220);
    return;
  }
  const pts = ((j.dataPoints as Json[]) ?? (j.rollupDataPoints as Json[]) ?? []) as Json[];
  probe.count = Array.isArray(pts) ? pts.length : 0;
  if (probe.count > 0) {
    probe.sampleKeys = collectKeys(pts[0]).slice(0, 40);
    probe.sample = pts[0];
  }
  if (!ok) {
    const err = j.error as { message?: string; status?: string } | undefined;
    probe.note = err?.message ?? JSON.stringify(j).slice(0, 220);
  }
}

/** Probe each type once and capture the raw truth: list for most, plus a
 *  dailyRollUp probe for steps + total-calories (which only support rollup). */
export async function inspectHealth(token: string): Promise<RawProbe[]> {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const out: RawProbe[] = [];

  for (const type of PROBE_TYPES) {
    const probe: RawProbe = { type, status: 0, ok: false, count: 0, sampleKeys: [] };
    try {
      const res = await fetch(`${BASE}/dataTypes/${type}/dataPoints?pageSize=3`, { headers, cache: "no-store" });
      probe.status = res.status;
      probe.ok = res.ok;
      const text = await res.text();
      let j: Json | null = null;
      try { j = JSON.parse(text) as Json; } catch { /* non-JSON body captured below */ }
      summarize(probe, j, text, res.ok);
    } catch (e) {
      probe.note = e instanceof Error ? e.message : "request failed";
    }
    out.push(probe);
  }

  // Real dailyRollUp calls with the correct `range` body (from discovery),
  // so we capture the rollup RESPONSE shape for steps + total-calories.
  const end = new Date();
  const start = new Date(end.getTime() - 6 * 864e5);
  const asYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  for (const type of ["steps", "total-calories"]) {
    const probe: RawProbe = { type: `${type} dailyRollUp [range]`, status: 0, ok: false, count: 0, sampleKeys: [] };
    try {
      const res = await fetch(`${BASE}/dataTypes/${type}/dataPoints:dailyRollUp`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(rollUpBody(asYmd(start), asYmd(end))),
        cache: "no-store",
      });
      probe.status = res.status;
      probe.ok = res.ok;
      const text = await res.text();
      let j: Json | null = null;
      try { j = JSON.parse(text) as Json; } catch { /* non-JSON body captured below */ }
      summarize(probe, j, text, res.ok);
    } catch (e) {
      probe.note = e instanceof Error ? e.message : "request failed";
    }
    out.push(probe);
  }

  return out;
}

/** Build the dailyRollUp `range` body (civil {date,time}) from YYYY-MM-DD strings. */
export function rollUpBody(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  return {
    range: {
      start: { date: { year: sy, month: sm, day: sd }, time: { hours: 0, minutes: 0, seconds: 0 } },
      end: { date: { year: ey, month: em, day: ed }, time: { hours: 23, minutes: 59, seconds: 59 } },
    },
    windowSizeDays: 1,
  };
}

async function dailyRollUp(type: string, token: string, startDate: string, endDate: string): Promise<Json[]> {
  const j = await api(`/dataTypes/${type}/dataPoints:dailyRollUp`, token, rollUpBody(startDate, endDate) as unknown as Json);
  return ((j?.dataPoints as Json[]) ?? (j?.rollupDataPoints as Json[]) ?? []) as Json[];
}

const camel = (t: string) => t.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hourOf = (iso: string) => {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 60 : 23;
};

/** Pull the last `daysBack` days from the Google Health API into DailySummary[]. */
export async function syncHealth(token: string, daysBack = 30): Promise<DailySummary[]> {
  const end = new Date();
  const start = new Date(end.getTime() - (daysBack - 1) * 864e5);
  const startDate = ymd(start);
  const endDate = ymd(end);
  const startIso = `${startDate}T00:00:00Z`;
  const endIso = new Date(end.getTime() + 864e5).toISOString();

  const byDate = new Map<string, Partial<DailySummary>>();
  const day = (date: string) => {
    let d = byDate.get(date);
    if (!d) {
      d = { date };
      byDate.set(date, d);
    }
    return d;
  };

  // Daily physiological summaries (list of per-day points)
  for (const p of await listPoints("daily-resting-heart-rate", token, startIso, endIso)) {
    const r = mapRhr(p);
    if (r) day(r.date).rhr = { date: r.date, bpm: r.bpm };
  }
  for (const p of await listPoints("daily-heart-rate-variability", token, startIso, endIso)) {
    const h = mapHrv(p);
    if (h) day(h.date).hrv = { date: h.date, rmssdMs: h.rmssdMs };
  }

  // Steps (dailyRollUp)
  for (const p of await dailyRollUp("steps", token, startDate, endDate)) {
    const s = mapStepsRollup(p);
    if (s) day(s.date).steps = s.steps;
  }
  // Total calories (dailyRollUp, chunked to the documented 14-day cap)
  for (let cs = new Date(start); cs <= end; cs = new Date(cs.getTime() + 14 * 864e5)) {
    const ce = new Date(Math.min(end.getTime(), cs.getTime() + 13 * 864e5));
    for (const p of await dailyRollUp("total-calories", token, ymd(cs), ymd(ce))) {
      const c = mapCaloriesRollup(p);
      if (c) {
        const d = day(c.date);
        d.restingCalories = Math.round(c.kcal * 0.72);
        d.activeCalories = c.kcal - d.restingCalories;
      }
    }
  }

  // Sleep sessions — prefer Fitbit's flagged main sleep, else the longest.
  const sleepIsMain = new Map<string, boolean>();
  for (const p of await listPoints("sleep", token, startIso, endIso)) {
    const s = mapSleep(p);
    if (!s) continue;
    const { mainSleep, ...session } = s;
    const existing = byDate.get(s.date)?.sleep;
    const existingMain = sleepIsMain.get(s.date) ?? false;
    if (!existing || (mainSleep && !existingMain) || (mainSleep === existingMain && session.asleepMin > existing.asleepMin)) {
      day(s.date).sleep = session;
      sleepIsMain.set(s.date, mainSleep);
    }
  }

  // Workouts / exercise sessions
  for (const p of await listPoints("exercise", token, startIso, endIso)) {
    const a = mapExercise(p);
    if (a) (day(a.date).activities ??= []).push(a);
  }

  // Weight
  for (const p of await listPoints("weight", token, startIso, endIso)) {
    const w = mapWeight(p);
    if (w) day(w.date).weightKg = w.kg;
  }

  // Assemble; derive sleep debt/consistency across the window.
  const dates = [...byDate.keys()].sort();
  const out: DailySummary[] = [];
  let debt = 0;
  const bedHours: number[] = [];
  for (const date of dates) {
    const p = byDate.get(date)!;
    if (!p.sleep && !p.rhr && !p.hrv && p.steps === undefined) continue;
    const sleep: SleepSession =
      p.sleep ??
      ({
        date,
        bedtime: `${date}T23:30:00`,
        wake: `${date}T07:00:00`,
        inBedMin: 0,
        asleepMin: 0,
        efficiencyPct: 0,
        stages: { awake: 0, light: 0, deep: 0, rem: 0 },
        awakenings: 0,
        sleepHrBpm: 0,
        overnightHrvMs: 0,
        consistencyPct: 0,
        debtMin: 0,
        needMin: 480,
      } satisfies SleepSession);
    sleep.sleepHrBpm = sleep.sleepHrBpm || (p.rhr?.bpm ?? 0);
    sleep.overnightHrvMs = p.hrv?.rmssdMs ?? 0;
    if (p.sleep) {
      debt = clamp(debt + (sleep.needMin - sleep.asleepMin) * 0.5, 0, 400);
      let bh = hourOf(sleep.bedtime);
      if (bh < 12) bh += 24;
      bedHours.push(bh);
      const mean = bedHours.reduce((a, b) => a + b, 0) / bedHours.length;
      sleep.consistencyPct = Math.round(clamp(95 - Math.abs(bh - mean) * 8, 40, 98));
    }
    sleep.debtMin = Math.round(debt);

    out.push({
      date,
      hrv: p.hrv ?? { date, rmssdMs: 0 },
      rhr: p.rhr ?? { date, bpm: 0 },
      sleep,
      activities: p.activities ?? [],
      steps: p.steps ?? 0,
      activeCalories: p.activeCalories ?? 0,
      restingCalories: p.restingCalories ?? 0,
      meals: [],
      medicationEvents: [],
      weightKg: p.weightKg,
    });
  }
  return out;
}
