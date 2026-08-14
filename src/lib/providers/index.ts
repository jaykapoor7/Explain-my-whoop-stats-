import "server-only";
import type { DailySummary } from "../types";
import { ouraFetchDays } from "./oura";

/**
 * Multi-provider wearable connectors. Each provider is a standard OAuth 2.0
 * "connect → auto-sync" integration, mirroring the Google Health one: the
 * deployer registers a developer app per provider and sets its client
 * credentials as env vars; users then connect with a single tap and CURA maps
 * the provider's data into the same DailySummary shape everything else uses.
 *
 * Field mappings are written from each provider's public API docs and are
 * defensive, but — exactly like Google Health — may need tuning against real
 * responses once credentials exist.
 */

export interface ProviderTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

export type TokenAuth = "basic" | "body";

export interface ProviderDef {
  id: string;
  name: string;
  color: string;
  tagline: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  pkce: boolean;
  tokenAuth: TokenAuth; // how the client secret is sent on token exchange
  /** Fetch + map the last `days` days into DailySummary[]. */
  fetchDays: (accessToken: string, days: number) => Promise<DailySummary[]>;
}

export const PROVIDERS: Record<string, ProviderDef> = {
  oura: {
    id: "oura",
    name: "Oura",
    color: "#7b68ee",
    tagline: "Ring · sleep, HRV, readiness",
    authorizeUrl: "https://cloud.ouraring.com/oauth/authorize",
    tokenUrl: "https://api.ouraring.com/oauth/token",
    scopes: "daily personal",
    pkce: false,
    tokenAuth: "body",
    fetchDays: ouraFetchDays,
  },
  whoop: {
    id: "whoop",
    name: "WHOOP",
    color: "#ef5a45",
    tagline: "Band · recovery, sleep, strain",
    authorizeUrl: "https://api.prod.whoop.com/oauth/oauth2/auth",
    tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
    scopes: "read:recovery read:sleep read:cycles read:workout offline",
    pkce: false,
    tokenAuth: "body",
    fetchDays: async () => [], // mapper added in a follow-up
  },
  fitbit: {
    id: "fitbit",
    name: "Fitbit",
    color: "#13b57e",
    tagline: "Direct · sleep, HR, steps",
    authorizeUrl: "https://www.fitbit.com/oauth2/authorize",
    tokenUrl: "https://api.fitbit.com/oauth2/token",
    scopes: "sleep heartrate activity profile",
    pkce: true,
    tokenAuth: "basic",
    fetchDays: async () => [],
  },
  polar: {
    id: "polar",
    name: "Polar",
    color: "#2298cf",
    tagline: "Flow · sleep, recharge, activity",
    authorizeUrl: "https://flow.polar.com/oauth2/authorization",
    tokenUrl: "https://polarremote.com/v2/oauth2/token",
    scopes: "accesslink.read_all",
    pkce: false,
    tokenAuth: "basic",
    fetchDays: async () => [],
  },
};

export function getProvider(id: string): ProviderDef | null {
  return PROVIDERS[id] ?? null;
}

/** Env credentials for a provider, e.g. OURA_CLIENT_ID / OURA_CLIENT_SECRET. */
export function providerCreds(id: string): { clientId?: string; clientSecret?: string } {
  const up = id.toUpperCase();
  return { clientId: process.env[`${up}_CLIENT_ID`], clientSecret: process.env[`${up}_CLIENT_SECRET`] };
}

export const providerCookie = (id: string) => `hos_p_${id}`;

export const encodeTokens = (t: ProviderTokens) => Buffer.from(JSON.stringify(t)).toString("base64");
export function decodeTokens(raw?: string): ProviderTokens | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as ProviderTokens;
    return t.access_token ? t : null;
  } catch {
    return null;
  }
}

function authHeader(p: ProviderDef, clientId: string, clientSecret: string): Record<string, string> {
  if (p.tokenAuth === "basic") {
    return { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` };
  }
  return {};
}

async function tokenRequest(p: ProviderDef, body: URLSearchParams, clientId: string, clientSecret: string, prevRefresh?: string): Promise<ProviderTokens> {
  if (p.tokenAuth === "body") { body.set("client_id", clientId); body.set("client_secret", clientSecret); }
  const res = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeader(p, clientId, clientSecret) },
    body,
  });
  if (!res.ok) throw new Error(`${p.name} token endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? prevRefresh ?? "",
    expires_at: Date.now() + (j.expires_in - 60) * 1000,
  };
}

export function exchangeCode(p: ProviderDef, code: string, redirect: string, clientId: string, clientSecret: string, verifier?: string): Promise<ProviderTokens> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect });
  if (p.pkce && verifier) body.set("code_verifier", verifier);
  if (p.tokenAuth === "basic") body.set("client_id", clientId); // some basic-auth providers still want it in the body
  return tokenRequest(p, body, clientId, clientSecret);
}

export function refreshTokens(p: ProviderDef, refresh: string, clientId: string, clientSecret: string): Promise<ProviderTokens> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh });
  return tokenRequest(p, body, clientId, clientSecret, refresh);
}

export function authorizeUrl(p: ProviderDef, clientId: string, redirect: string, state: string, challenge?: string): string {
  const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirect, scope: p.scopes, state });
  if (p.pkce && challenge) { q.set("code_challenge", challenge); q.set("code_challenge_method", "S256"); }
  return `${p.authorizeUrl}?${q}`;
}
