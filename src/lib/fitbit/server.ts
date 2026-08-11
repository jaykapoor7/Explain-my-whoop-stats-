import "server-only";
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { Activity, ActivityConfidence, DailySummary, SleepSession } from "../types";

/**
 * Fitbit Web API integration (covers Fitbit Air — the device syncs to the
 * Fitbit app, and its data is exposed via this API). OAuth 2.0 public client
 * with PKCE, so only a Client ID is required — no secret, no server storage.
 * Tokens live in httpOnly cookies; synced data is returned to the browser and
 * stored locally. Nothing is persisted server-side.
 */

export const COOKIES = {
  client: "hos_fb_client",
  token: "hos_fb_token",
  state: "hos_fb_state",
  verifier: "hos_fb_verifier",
};

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  user_id?: string;
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const randomToken = (n = 32) => b64url(crypto.randomBytes(n));

export function pkcePair() {
  const verifier = randomToken(48);
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export const SCOPES = "activity heartrate sleep weight profile";

export function clientId(req: NextRequest): string | null {
  return process.env.FITBIT_CLIENT_ID ?? req.cookies.get(COOKIES.client)?.value ?? null;
}

export function redirectUri(origin: string): string {
  return `${(process.env.APP_URL ?? origin).replace(/\/$/, "")}/api/fitbit/callback`;
}

export function authorizeUrl(id: string, redirect: string, state: string, challenge: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: id,
    scope: SCOPES,
    redirect_uri: redirect,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://www.fitbit.com/oauth2/authorize?${p}`;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenSet> {
  const res = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Fitbit token endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number; user_id?: string };
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in - 60) * 1000,
    user_id: j.user_id,
  };
}

export function exchangeCode(id: string, code: string, redirect: string, verifier: string): Promise<TokenSet> {
  return tokenRequest(
    new URLSearchParams({ client_id: id, grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier })
  );
}

export function refreshToken(id: string, refresh: string): Promise<TokenSet> {
  return tokenRequest(new URLSearchParams({ client_id: id, grant_type: "refresh_token", refresh_token: refresh }));
}

export const encodeToken = (t: TokenSet) => Buffer.from(JSON.stringify(t)).toString("base64");
export function decodeToken(raw?: string): TokenSet | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as TokenSet;
    return t.access_token && t.refresh_token ? t : null;
  } catch {
    return null;
  }
}

// ---------------- data fetch + mapping ----------------

const API = "https://api.fitbit.com";

async function get<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hourOf = (iso: string) => {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 60 : 23;
};

/** Pull the last `daysBack` days and map into the app's DailySummary model. ~7 API calls. */
export async function syncFitbit(token: string, daysBack = 30): Promise<DailySummary[]> {
  const end = new Date();
  const start = new Date(end.getTime() - (daysBack - 1) * 864e5);
  const s = ymd(start);
  const e = ymd(end);
  const byDate = new Map<string, Partial<DailySummary>>();
  const day = (date: string) => {
    let d = byDate.get(date);
    if (!d) {
      d = { date };
      byDate.set(date, d);
    }
    return d;
  };

  // Sleep (range endpoint, v1.2)
  const sleep = await get<{ sleep?: FbSleep[] }>(`/1.2/user/-/sleep/date/${s}/${e}.json`, token);
  for (const rec of sleep?.sleep ?? []) {
    if (rec.isMainSleep === false) continue;
    const sum = rec.levels?.summary ?? {};
    const stage = (k: string) => sum[k]?.minutes ?? 0;
    const classic = stage("asleep") > 0; // classic logs lack stages
    const asleepMin = rec.minutesAsleep ?? 0;
    const session: SleepSession = {
      date: rec.dateOfSleep,
      bedtime: rec.startTime ?? `${rec.dateOfSleep}T23:00:00`,
      wake: rec.endTime ?? `${rec.dateOfSleep}T07:00:00`,
      inBedMin: rec.timeInBed ?? asleepMin,
      asleepMin,
      efficiencyPct: rec.efficiency ?? 0,
      stages: classic
        ? { awake: stage("awake") + stage("restless"), light: asleepMin, deep: 0, rem: 0 }
        : { awake: stage("wake"), light: stage("light"), deep: stage("deep"), rem: stage("rem") },
      awakenings: classic ? (sum["awake"]?.count ?? 0) : (sum["wake"]?.count ?? 0),
      sleepHrBpm: 0, // filled from RHR below (approximation; intraday HR needs special access)
      overnightHrvMs: 0, // filled from HRV below (Fitbit HRV is measured during sleep)
      consistencyPct: 0, // computed after all days are known
      debtMin: 0,
      needMin: 480,
    };
    day(rec.dateOfSleep).sleep = session;
  }

  // HRV (daily rmssd; ≤30d per request)
  const hrv = await get<{ hrv?: { dateTime: string; value?: { dailyRmssd?: number } }[] }>(`/1/user/-/hrv/date/${s}/${e}.json`, token);
  for (const r of hrv?.hrv ?? []) {
    if (r.value?.dailyRmssd != null) day(r.dateTime).hrv = { date: r.dateTime, rmssdMs: Math.round(r.value.dailyRmssd) };
  }

  // Resting HR
  const heart = await get<{ "activities-heart"?: { dateTime: string; value?: { restingHeartRate?: number } }[] }>(
    `/1/user/-/activities/heart/date/${s}/${e}.json`,
    token
  );
  for (const r of heart?.["activities-heart"] ?? []) {
    if (r.value?.restingHeartRate != null) day(r.dateTime).rhr = { date: r.dateTime, bpm: r.value.restingHeartRate };
  }

  // Steps + calories
  const steps = await get<{ "activities-steps"?: { dateTime: string; value: string }[] }>(`/1/user/-/activities/steps/date/${s}/${e}.json`, token);
  for (const r of steps?.["activities-steps"] ?? []) day(r.dateTime).steps = parseInt(r.value, 10) || 0;
  const cals = await get<{ "activities-calories"?: { dateTime: string; value: string }[] }>(`/1/user/-/activities/calories/date/${s}/${e}.json`, token);
  for (const r of cals?.["activities-calories"] ?? []) {
    const total = parseInt(r.value, 10) || 0;
    const d = day(r.dateTime);
    d.restingCalories = Math.round(total * 0.72); // split refined below when workouts known
    d.activeCalories = total - d.restingCalories;
  }

  // Workouts
  const acts = await get<{ activities?: FbActivity[] }>(
    `/1/user/-/activities/list.json?afterDate=${s}&sort=asc&offset=0&limit=100`,
    token
  );
  for (const a of acts?.activities ?? []) {
    const date = (a.startTime ?? "").slice(0, 10);
    if (!date || date < s) continue;
    const durMin = Math.round((a.duration ?? 0) / 60000);
    const zonesRaw = a.heartRateZones ?? [];
    const zmin = (n: string) => zonesRaw.find((z) => z.name === n)?.minutes ?? 0;
    const zones = [zmin("Out of Range"), zmin("Fat Burn"), zmin("Cardio"), zmin("Peak"), 0];
    // Placeholder load model: HR-zone-weighted minutes (final algorithm designed separately).
    const load = clamp(zmin("Fat Burn") * 0.05 + zmin("Cardio") * 0.13 + zmin("Peak") * 0.22 + zmin("Out of Range") * 0.02 + durMin * 0.015, 0.3, 19);
    const confidence: ActivityConfidence =
      a.logType === "auto_detected" && durMin < 15 ? "low" : a.logType === "auto_detected" ? "medium" : "high";
    const act: Activity = {
      id: `fb-${a.logId}`,
      date,
      type: durMin < 15 && a.logType === "auto_detected" ? "Unrecognized elevated HR" : (a.activityName ?? "Workout"),
      start: a.startTime ?? `${date}T12:00:00`,
      durationMin: durMin,
      avgHr: a.averageHeartRate ?? 0,
      maxHr: 0,
      calories: a.calories ?? 0,
      zones,
      load: Math.round(load * 10) / 10,
      confidence,
    };
    const d = day(date);
    d.activities = [...(d.activities ?? []), act];
  }

  // Weight (optional)
  const weight = await get<{ weight?: { date: string; weight: number }[] }>(`/1/user/-/body/log/weight/date/${s}/${e}.json`, token);
  for (const r of weight?.weight ?? []) day(r.date).weightKg = r.weight;

  // Assemble complete days; fill derived sleep fields.
  const dates = [...byDate.keys()].sort();
  const out: DailySummary[] = [];
  let debt = 0;
  const bedHours: number[] = [];
  for (const date of dates) {
    const p = byDate.get(date)!;
    if (!p.sleep && !p.rhr && !p.hrv && !p.steps) continue; // nothing useful
    const sleepSession: SleepSession =
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
    const rhrBpm = p.rhr?.bpm ?? 0;
    sleepSession.sleepHrBpm = sleepSession.sleepHrBpm || rhrBpm;
    sleepSession.overnightHrvMs = p.hrv?.rmssdMs ?? 0;
    if (p.sleep) {
      debt = clamp(debt + (sleepSession.needMin - sleepSession.asleepMin) * 0.5, 0, 400);
      let bh = hourOf(sleepSession.bedtime);
      if (bh < 12) bh += 24;
      bedHours.push(bh);
      const mean = bedHours.reduce((a, b) => a + b, 0) / bedHours.length;
      sleepSession.consistencyPct = Math.round(clamp(95 - Math.abs(bh - mean) * 8, 40, 98));
    }
    sleepSession.debtMin = Math.round(debt);

    out.push({
      date,
      hrv: p.hrv ?? { date, rmssdMs: 0 },
      rhr: p.rhr ?? { date, bpm: 0 },
      sleep: sleepSession,
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

interface FbSleep {
  dateOfSleep: string;
  isMainSleep?: boolean;
  startTime?: string;
  endTime?: string;
  minutesAsleep?: number;
  timeInBed?: number;
  efficiency?: number;
  levels?: { summary?: Record<string, { minutes?: number; count?: number }> };
}

interface FbActivity {
  logId: number;
  activityName?: string;
  startTime?: string;
  duration?: number;
  averageHeartRate?: number;
  calories?: number;
  logType?: string;
  heartRateZones?: { name: string; minutes?: number }[];
}
