import "server-only";

/**
 * Server-only OAuth provider configuration. Client id/secret come from
 * environment variables and never reach the browser. Redirect URIs are
 * derived from the request origin so the same code works on localhost and
 * any deployed domain.
 */

export interface OAuthConfig {
  id: string;
  label: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  /** how client credentials are presented at the token endpoint */
  tokenAuth: "body" | "basic";
  usePkce: boolean;
  clientId?: string;
  clientSecret?: string;
}

export const OAUTH_CONFIG: Record<string, OAuthConfig> = {
  whoop: {
    id: "whoop",
    label: "WHOOP",
    authUrl: "https://api.prod.whoop.com/oauth/oauth2/auth",
    tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
    // "offline" yields a refresh token so we can re-sync without re-auth.
    scope: "offline read:recovery read:sleep read:workout read:cycles read:profile",
    tokenAuth: "body",
    usePkce: false,
    clientId: process.env.WHOOP_CLIENT_ID,
    clientSecret: process.env.WHOOP_CLIENT_SECRET,
  },
  oura: {
    id: "oura",
    label: "Oura",
    authUrl: "https://cloud.ouraring.com/oauth/authorize",
    tokenUrl: "https://api.ouraring.com/oauth/token",
    scope: "daily heartrate workout personal session",
    tokenAuth: "body",
    usePkce: false,
    clientId: process.env.OURA_CLIENT_ID,
    clientSecret: process.env.OURA_CLIENT_SECRET,
  },
  fitbit: {
    id: "fitbit",
    label: "Fitbit",
    authUrl: "https://www.fitbit.com/oauth2/authorize",
    tokenUrl: "https://api.fitbit.com/oauth2/token",
    scope: "heartrate sleep activity profile",
    // Fitbit confidential clients authenticate the token call with Basic auth
    // and additionally require PKCE.
    tokenAuth: "basic",
    usePkce: true,
    clientId: process.env.FITBIT_CLIENT_ID,
    clientSecret: process.env.FITBIT_CLIENT_SECRET,
  },
};

export function getOAuthConfig(provider: string): OAuthConfig | undefined {
  return OAUTH_CONFIG[provider];
}

export function isConfigured(provider: string): boolean {
  const c = OAUTH_CONFIG[provider];
  return !!(c && c.clientId && c.clientSecret);
}

/** Absolute callback URL for a provider, derived from the incoming request. */
export function redirectUri(origin: string, provider: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, "") || origin;
  return `${base}/api/oauth/${provider}/callback`;
}
