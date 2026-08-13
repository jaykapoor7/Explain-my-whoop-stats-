import "server-only";
import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * Stateless session + secret handling for "Sign in with Google".
 *
 * The session is a signed cookie (HMAC-SHA256) carrying the user's stable
 * Google subject id and an expiry — no server session table needed. The
 * user's Google refresh token is encrypted at rest (AES-256-GCM) before it
 * ever touches the database.
 *
 * Set AUTH_SECRET in production. Without it we derive a warned-about dev
 * secret so the app still runs locally.
 */

export const SESSION_COOKIE = "hos_session";
const SESSION_TTL_MS = 60 * 60 * 24 * 90 * 1000; // 90 days

let warned = false;
function secret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (s) return crypto.createHash("sha256").update(s).digest();
  if (!warned) {
    warned = true;
    console.warn("[auth] AUTH_SECRET is not set — using an insecure dev secret. Set AUTH_SECRET in production.");
  }
  return crypto.createHash("sha256").update("health-os-insecure-dev-secret").digest();
}

const b64url = (b: Buffer) => b.toString("base64url");

export interface Session {
  sub: string; // Google subject id
  exp: number; // epoch ms
}

export function signSession(sub: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ sub, exp: Date.now() + SESSION_TTL_MS })));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(raw?: string): Session | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expect = b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!s.sub || typeof s.exp !== "number" || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function getSession(req: NextRequest): Session | null {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(secure: boolean) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: Math.floor(SESSION_TTL_MS / 1000) };
}

// --- Refresh-token encryption (AES-256-GCM) ---

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secret(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [b64url(iv), b64url(tag), b64url(enc)].join(".");
}

export function decryptSecret(blob?: string): string | null {
  if (!blob) return null;
  const [iv, tag, enc] = blob.split(".");
  if (!iv || !tag || !enc) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", secret(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Decode a Google ID token's payload (no signature check — it came straight
 * from Google's token endpoint over TLS in a server-to-server exchange). */
export function decodeIdToken(idToken?: string): { sub: string; email?: string; name?: string; picture?: string } | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      sub?: string; email?: string; name?: string; picture?: string;
    };
    return p.sub ? { sub: p.sub, email: p.email, name: p.name, picture: p.picture } : null;
  } catch {
    return null;
  }
}
