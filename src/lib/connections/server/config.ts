import "server-only";
import type { NextRequest } from "next/server";

/**
 * Provider specs plus per-request credential resolution. Credentials can come
 * from environment variables OR from an in-app cookie the user sets on the
 * Connections page — so no Vercel env vars / redeploys are required.
 */

export interface ProviderSpec {
  id: string;
  label: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  usePkce: boolean;
  /** OAuth requires a client secret (WHOOP/Oura). Fitbit uses a public PKCE client. */
  secretRequired: boolean;
}

export const SPECS: Record<string, ProviderSpec> = {
  whoop: {
    id: "whoop",
    label: "WHOOP",
    authUrl: "https://api.prod.whoop.com/oauth/oauth2/auth",
    tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
    scope: "offline read:recovery read:sleep read:workout read:cycles read:profile",
    usePkce: false,
    secretRequired: true,
  },
  oura: {
    id: "oura",
    label: "Oura",
    authUrl: "https://cloud.ouraring.com/oauth/authorize",
    tokenUrl: "https://api.ouraring.com/oauth/token",
    scope: "daily heartrate workout personal session",
    usePkce: false,
    secretRequired: true,
  },
  fitbit: {
    id: "fitbit",
    label: "Fitbit",
    authUrl: "https://www.fitbit.com/oauth2/authorize",
    tokenUrl: "https://api.fitbit.com/oauth2/token",
    scope: "heartrate sleep activity profile",
    usePkce: true,
    secretRequired: false,
  },
};

export interface Creds {
  clientId: string;
  clientSecret?: string;
}

export interface ResolvedConfig extends ProviderSpec, Creds {}

const ENV = (id: string) => id.toUpperCase();

export function envCreds(id: string): Creds | null {
  const clientId = process.env[`${ENV(id)}_CLIENT_ID`];
  const clientSecret = process.env[`${ENV(id)}_CLIENT_SECRET`];
  return clientId ? { clientId, clientSecret } : null;
}

export const credCookieName = (id: string) => `rc_cred_${id}`;

export function serializeCreds(c: Creds): string {
  return Buffer.from(JSON.stringify(c)).toString("base64");
}

export function parseCreds(raw: string | undefined): Creds | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Creds;
    return c.clientId ? c : null;
  } catch {
    return null;
  }
}

/** Credentials from env first, then the in-app cookie. */
export function resolveCreds(id: string, req: NextRequest): Creds | null {
  return envCreds(id) ?? parseCreds(req.cookies.get(credCookieName(id))?.value);
}

export function resolvedConfig(id: string, req: NextRequest): ResolvedConfig | null {
  const spec = SPECS[id];
  if (!spec) return null;
  const creds = resolveCreds(id, req);
  if (!creds) return null;
  return { ...spec, ...creds };
}

/** True when the provider has everything it needs to run its OAuth flow. */
export function oauthReady(id: string, req: NextRequest): boolean {
  const spec = SPECS[id];
  const creds = resolveCreds(id, req);
  if (!spec || !creds) return false;
  return spec.secretRequired ? !!creds.clientSecret : true;
}

export function getSpec(id: string): ProviderSpec | undefined {
  return SPECS[id];
}

/** Absolute callback URL for a provider, derived from the incoming request. */
export function redirectUri(origin: string, provider: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, "") || origin;
  return `${base}/api/oauth/${provider}/callback`;
}
