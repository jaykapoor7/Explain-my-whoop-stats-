import "server-only";
import crypto from "crypto";

/**
 * Ephemeral device-pairing store. When a signed-in device wants to hand its
 * Google Health connection to another device (e.g. laptop → phone), it mints a
 * short pairing code here that maps to the raw httpOnly cookie values (OAuth
 * token + client creds). The other device redeems the code once, within a few
 * minutes, and the entry is destroyed.
 *
 * The code is high-entropy and single-use, so the code alone is useless without
 * this server. Nothing is written to disk — this is an in-memory map, which is
 * the right fit for a single Node instance. (On a multi-instance/serverless
 * deploy this would need a shared KV store instead.)
 */

export interface PairingPayload {
  token: string; // raw value of the hos_gh_token cookie
  client?: string; // raw value of the hos_gh_client cookie (absent when app ships env creds)
}

interface Entry extends PairingPayload {
  expiresAt: number;
}

const TTL_MS = 3 * 60 * 1000; // 3 minutes
const store = new Map<string, Entry>();

function sweep() {
  const now = Date.now();
  for (const [code, e] of store) if (e.expiresAt <= now) store.delete(code);
}

/** A short, URL-safe, hard-to-guess code (~120 bits). */
function makeCode(): string {
  return crypto.randomBytes(15).toString("base64url");
}

export function createPairing(payload: PairingPayload): { code: string; ttlMs: number } {
  sweep();
  const code = makeCode();
  store.set(code, { ...payload, expiresAt: Date.now() + TTL_MS });
  return { code, ttlMs: TTL_MS };
}

/** Redeem a code exactly once. Returns the payload, or null if invalid/expired. */
export function redeemPairing(code: string): PairingPayload | null {
  sweep();
  const e = store.get(code);
  if (!e) return null;
  store.delete(code); // single use
  if (e.expiresAt <= Date.now()) return null;
  return { token: e.token, client: e.client };
}
