import "server-only";
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { Activity, ActivityConfidence, DailySummary, SleepSession } from "../types";

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

/** Probe each type once (unfiltered, tiny page) and capture the raw truth. */
export async function inspectHealth(token: string): Promise<RawProbe[]> {
  const out: RawProbe[] = [];
  for (const type of PROBE_TYPES) {
    const probe: RawProbe = { type, status: 0, ok: false, count: 0, sampleKeys: [] };
    try {
      const res = await fetch(`${BASE}/dataTypes/${type}/dataPoints?pageSize=3`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      probe.status = res.status;
      probe.ok = res.ok;
      const text = await res.text();
      let j: Json | null = null;
      try {
        j = JSON.parse(text) as Json;
      } catch {
        probe.note = text.slice(0, 220);
      }
      if (j) {
        const pts = ((j.dataPoints as Json[]) ?? (j.rollupDataPoints as Json[]) ?? []) as Json[];
        probe.count = Array.isArray(pts) ? pts.length : 0;
        if (probe.count > 0) {
          probe.sampleKeys = collectKeys(pts[0]).slice(0, 40);
          probe.sample = pts[0];
        }
        if (!probe.ok) {
          const err = j.error as { message?: string; status?: string } | undefined;
          probe.note = err?.message ?? JSON.stringify(j).slice(0, 220);
        }
      }
    } catch (e) {
      probe.note = e instanceof Error ? e.message : "request failed";
    }
    out.push(probe);
  }
  return out;
}

/** POST dailyRollUp for a type across [startDate, endDate] (civil dates). */
async function dailyRollUp(type: string, token: string, startDate: string, endDate: string): Promise<Json[]> {
  const j = await api(`/dataTypes/${type}/dataPoints:dailyRollUp`, token, {
    startDate,
    endDate,
    windowSizeDays: 1,
  });
  return ((j?.dataPoints as Json[]) ?? (j?.rollupDataPoints as Json[]) ?? []) as Json[];
}

const camel = (t: string) => t.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

// --- tolerant field extraction (exact per-type payload fields are not all
// --- publicly documented; probe the documented/likely shapes, skip on miss)

function num(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (isFinite(n)) return n;
  }
  return undefined;
}

function pick(obj: Json | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
    // nested one level (e.g. { value: { bpm: 62 } } or typed wrapper)
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object" && (v as Json)[k] !== undefined) return (v as Json)[k];
    }
  }
  return undefined;
}

function pointDate(p: Json): string | undefined {
  const cand =
    pick(p, "date", "civilDate", "startDate") ??
    pick(p, "startTime", "physicalTime", "sampleTime", "time", "endTime");
  if (typeof cand === "string") {
    const m = cand.match(/^\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  if (cand && typeof cand === "object") {
    const y = num((cand as Json).year);
    const mo = num((cand as Json).month);
    const d = num((cand as Json).day);
    if (y && mo && d) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return undefined;
}

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
    const date = pointDate(p);
    const bpm = num(pick(p, "restingHeartRate", "bpm", "value", "beatsPerMinute"));
    if (date && bpm) day(date).rhr = { date, bpm: Math.round(bpm) };
  }
  for (const p of await listPoints("daily-heart-rate-variability", token, startIso, endIso)) {
    const date = pointDate(p);
    const rmssd = num(pick(p, "rmssd", "dailyRmssd", "value", "rmssdMillis"));
    if (date && rmssd) day(date).hrv = { date, rmssdMs: Math.round(rmssd) };
  }

  // Steps + calories via dailyRollUp (steps ≤90d; total-calories ≤14d → chunk)
  for (const p of await dailyRollUp("steps", token, startDate, endDate)) {
    const date = pointDate(p);
    const steps = num(pick(p, "countSum", "steps", "sum", "value"));
    if (date && steps !== undefined) day(date).steps = Math.round(steps);
  }
  for (let chunkStart = new Date(start); chunkStart <= end; chunkStart = new Date(chunkStart.getTime() + 14 * 864e5)) {
    const chunkEnd = new Date(Math.min(end.getTime(), chunkStart.getTime() + 13 * 864e5));
    for (const p of await dailyRollUp("total-calories", token, ymd(chunkStart), ymd(chunkEnd))) {
      const date = pointDate(p);
      const kcal = num(pick(p, "energySum", "caloriesSum", "kilocalories", "sum", "value", "countSum"));
      if (date && kcal !== undefined) {
        const d = day(date);
        d.restingCalories = Math.round(kcal * 0.72);
        d.activeCalories = Math.round(kcal) - d.restingCalories;
      }
    }
  }

  // Sleep sessions
  for (const p of await listPoints("sleep", token, startIso, endIso)) {
    const startTime = (pick(p, "startTime", "physicalStartTime", "bedtime") as string) ?? "";
    const endTime = (pick(p, "endTime", "physicalEndTime", "wakeTime") as string) ?? "";
    const date = (endTime || startTime).slice(0, 10) || pointDate(p);
    if (!date) continue;
    const stageMin = (names: string[]) => {
      const v = num(pick(p, ...names));
      return v !== undefined ? Math.round(v) : 0;
    };
    const deep = stageMin(["deepSleepMinutes", "minutesDeep", "deep"]);
    const rem = stageMin(["remSleepMinutes", "minutesRem", "rem"]);
    const light = stageMin(["lightSleepMinutes", "minutesLight", "light"]);
    const awake = stageMin(["awakeMinutes", "minutesAwake", "wake", "awake"]);
    let asleepMin = num(pick(p, "minutesAsleep", "totalSleepMinutes", "asleepMinutes")) ?? deep + rem + light;
    if (!asleepMin && startTime && endTime) {
      asleepMin = Math.max(0, Math.round((Date.parse(endTime) - Date.parse(startTime)) / 60000) - awake);
    }
    if (!asleepMin) continue;
    const inBedMin = num(pick(p, "timeInBedMinutes", "minutesInBed")) ?? asleepMin + awake;
    const existing = byDate.get(date)?.sleep;
    if (existing && existing.asleepMin >= asleepMin) continue; // keep main sleep
    const session: SleepSession = {
      date,
      bedtime: startTime || `${date}T23:30:00`,
      wake: endTime || `${date}T07:00:00`,
      inBedMin: Math.round(inBedMin),
      asleepMin: Math.round(asleepMin),
      efficiencyPct: Math.round(num(pick(p, "efficiency", "efficiencyPct")) ?? clamp((asleepMin / Math.max(1, inBedMin)) * 100, 40, 99)),
      stages: { awake, light: light || Math.max(0, Math.round(asleepMin) - deep - rem), deep, rem },
      awakenings: Math.round(num(pick(p, "awakeningsCount", "awakenings", "wakeCount")) ?? 0),
      sleepHrBpm: 0,
      overnightHrvMs: 0,
      consistencyPct: 0,
      debtMin: 0,
      needMin: 480,
    };
    day(date).sleep = session;
  }

  // Workouts / exercise sessions
  for (const p of await listPoints("exercise", token, startIso, endIso)) {
    const startTime = (pick(p, "startTime", "physicalStartTime") as string) ?? "";
    const date = startTime.slice(0, 10) || pointDate(p);
    if (!date) continue;
    let durMin = num(pick(p, "durationMinutes", "activeDurationMinutes"));
    if (durMin === undefined) {
      const endTime = (pick(p, "endTime", "physicalEndTime") as string) ?? "";
      const durMs = num(pick(p, "durationMillis", "duration"));
      durMin = durMs !== undefined ? durMs / 60000 : endTime && startTime ? (Date.parse(endTime) - Date.parse(startTime)) / 60000 : 0;
    }
    durMin = Math.round(durMin);
    if (durMin <= 0) continue;
    const name = (pick(p, "exerciseType", "activityName", "activityType", "name", "type") as string) ?? "Workout";
    const auto = ((pick(p, "logType", "source", "detectionMethod") as string) ?? "").toLowerCase().includes("auto");
    const confidence: ActivityConfidence = auto && durMin < 15 ? "low" : auto ? "medium" : "high";
    const avgHr = Math.round(num(pick(p, "averageHeartRate", "avgHeartRate", "meanHeartRate")) ?? 0);
    const kcal = Math.round(num(pick(p, "calories", "energyExpended", "kilocalories")) ?? 0);
    const load = clamp(durMin * 0.06 + (avgHr > 0 ? Math.max(0, avgHr - 100) * 0.045 : 2), 0.3, 19);
    const acts = (day(date).activities ??= []);
    acts.push({
      id: `gh-${pick(p, "dataPointId", "id", "logId") ?? `${date}-${acts.length}`}`,
      date,
      type: auto && durMin < 15 ? "Unrecognized elevated HR" : humanize(String(name)),
      start: startTime || `${date}T12:00:00`,
      durationMin: durMin,
      avgHr,
      maxHr: Math.round(num(pick(p, "maxHeartRate", "peakHeartRate")) ?? 0),
      calories: kcal,
      zones: [0, 0, 0, 0, 0],
      load: Math.round(load * 10) / 10,
      confidence,
    } satisfies Activity);
  }

  // Weight
  for (const p of await listPoints("weight", token, startIso, endIso)) {
    const date = pointDate(p);
    const kg = num(pick(p, "weightKg", "kilograms", "weight", "value"));
    if (date && kg) day(date).weightKg = Math.round(kg * 10) / 10;
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

function humanize(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
