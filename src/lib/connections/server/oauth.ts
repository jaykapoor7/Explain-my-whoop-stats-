import "server-only";
import crypto from "crypto";
import { OAuthConfig } from "./config";

/** OAuth 2.0 helpers: PKCE, CSRF state, code exchange, refresh, token cookies. */

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
}

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function randomToken(bytes = 32): string {
  return b64url(crypto.randomBytes(bytes));
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(48);
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthUrl(
  config: OAuthConfig,
  redirectUri: string,
  state: string,
  challenge?: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId!,
    redirect_uri: redirectUri,
    scope: config.scope,
    state,
  });
  if (config.usePkce && challenge) {
    params.set("code_challenge", challenge);
    params.set("code_challenge_method", "S256");
  }
  return `${config.authUrl}?${params.toString()}`;
}

async function tokenRequest(config: OAuthConfig, body: URLSearchParams): Promise<TokenSet> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (config.tokenAuth === "basic") {
    headers.Authorization =
      "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  } else {
    body.set("client_id", config.clientId!);
    body.set("client_secret", config.clientSecret!);
  }
  const res = await fetch(config.tokenUrl, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export function exchangeCode(
  config: OAuthConfig,
  code: string,
  redirectUri: string,
  verifier?: string
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  if (config.usePkce && verifier) body.set("code_verifier", verifier);
  return tokenRequest(config, body);
}

export function refreshToken(config: OAuthConfig, refresh_token: string): Promise<TokenSet> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token });
  // Some providers require the scope be re-sent on refresh; harmless when ignored.
  if (config.id === "whoop") body.set("scope", "offline");
  return tokenRequest(config, body);
}

// ---- token cookie serialization ----

export const tokenCookieName = (provider: string) => `rc_conn_${provider}`;
export const STATE_COOKIE = "rc_oauth_state";
export const VERIFIER_COOKIE = "rc_oauth_verifier";

export function serializeToken(t: TokenSet): string {
  return Buffer.from(JSON.stringify(t)).toString("base64");
}

export function parseToken(raw: string | undefined): TokenSet | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as TokenSet;
    return t.access_token ? t : null;
  } catch {
    return null;
  }
}
