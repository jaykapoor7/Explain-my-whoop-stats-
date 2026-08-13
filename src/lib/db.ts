import "server-only";
import fs from "fs";
import path from "path";
import { Pool, type Pool as PgPool } from "pg";

/**
 * Tiny persistence layer for accounts + cloud sync.
 *
 * - Production: set DATABASE_URL to a Postgres connection string. Tables are
 *   created on first use.
 * - Local / no DATABASE_URL: falls back to a JSON file under .data/ so the app
 *   runs with zero setup (single-server only).
 *
 * We store just what cloud sync needs: the user's profile, their encrypted
 * Google refresh token, and one app-state snapshot per user.
 */

export interface UserRow {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface Store {
  upsertUser(u: UserRow): Promise<void>;
  getUser(sub: string): Promise<UserRow | null>;
  saveGoogleAuth(sub: string, encryptedRefresh: string): Promise<void>;
  getGoogleAuth(sub: string): Promise<string | null>;
  getSnapshot(sub: string): Promise<{ data: string; updatedAt: number } | null>;
  saveSnapshot(sub: string, data: string, updatedAt: number): Promise<void>;
  deleteUser(sub: string): Promise<void>;
}

// ---------------- Postgres ----------------

class PgStore implements Store {
  private pool: PgPool;
  private ready: Promise<void>;
  constructor(connectionString: string) {
    const ssl = /\bsslmode=require\b/.test(connectionString) || /neon\.tech|supabase\.co|render\.com/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined;
    this.pool = new Pool({ connectionString, ssl, max: 3 });
    this.ready = this.init();
  }
  private async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        sub text PRIMARY KEY, email text, name text, picture text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS google_auth (
        sub text PRIMARY KEY REFERENCES users(sub) ON DELETE CASCADE,
        refresh_token text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS snapshots (
        sub text PRIMARY KEY REFERENCES users(sub) ON DELETE CASCADE,
        data text NOT NULL, updated_at bigint NOT NULL
      );
    `);
  }
  async upsertUser(u: UserRow) {
    await this.ready;
    await this.pool.query(
      `INSERT INTO users (sub, email, name, picture) VALUES ($1,$2,$3,$4)
       ON CONFLICT (sub) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture`,
      [u.sub, u.email ?? null, u.name ?? null, u.picture ?? null]
    );
  }
  async getUser(sub: string) {
    await this.ready;
    const r = await this.pool.query("SELECT sub, email, name, picture FROM users WHERE sub=$1", [sub]);
    return (r.rows[0] as UserRow) ?? null;
  }
  async saveGoogleAuth(sub: string, encryptedRefresh: string) {
    await this.ready;
    await this.pool.query(
      `INSERT INTO google_auth (sub, refresh_token, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (sub) DO UPDATE SET refresh_token=EXCLUDED.refresh_token, updated_at=now()`,
      [sub, encryptedRefresh]
    );
  }
  async getGoogleAuth(sub: string) {
    await this.ready;
    const r = await this.pool.query("SELECT refresh_token FROM google_auth WHERE sub=$1", [sub]);
    return (r.rows[0]?.refresh_token as string) ?? null;
  }
  async getSnapshot(sub: string) {
    await this.ready;
    const r = await this.pool.query("SELECT data, updated_at FROM snapshots WHERE sub=$1", [sub]);
    if (!r.rows[0]) return null;
    return { data: r.rows[0].data as string, updatedAt: Number(r.rows[0].updated_at) };
  }
  async saveSnapshot(sub: string, data: string, updatedAt: number) {
    await this.ready;
    await this.pool.query(
      `INSERT INTO snapshots (sub, data, updated_at) VALUES ($1,$2,$3)
       ON CONFLICT (sub) DO UPDATE SET data=EXCLUDED.data, updated_at=EXCLUDED.updated_at`,
      [sub, data, updatedAt]
    );
  }
  async deleteUser(sub: string) {
    await this.ready;
    await this.pool.query("DELETE FROM users WHERE sub=$1", [sub]);
  }
}

// ---------------- JSON file fallback ----------------

interface FileShape {
  users: Record<string, UserRow>;
  auth: Record<string, string>;
  snapshots: Record<string, { data: string; updatedAt: number }>;
}

class FileStore implements Store {
  private file: string;
  constructor() {
    const dir = path.join(process.cwd(), ".data");
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    this.file = path.join(dir, "health-os.json");
  }
  private read(): FileShape {
    try { return JSON.parse(fs.readFileSync(this.file, "utf8")) as FileShape; }
    catch { return { users: {}, auth: {}, snapshots: {} }; }
  }
  private write(d: FileShape) {
    try { fs.writeFileSync(this.file, JSON.stringify(d)); } catch { /* read-only fs: best effort */ }
  }
  async upsertUser(u: UserRow) { const d = this.read(); d.users[u.sub] = { ...d.users[u.sub], ...u }; this.write(d); }
  async getUser(sub: string) { return this.read().users[sub] ?? null; }
  async saveGoogleAuth(sub: string, t: string) { const d = this.read(); d.auth[sub] = t; this.write(d); }
  async getGoogleAuth(sub: string) { return this.read().auth[sub] ?? null; }
  async getSnapshot(sub: string) { return this.read().snapshots[sub] ?? null; }
  async saveSnapshot(sub: string, data: string, updatedAt: number) { const d = this.read(); d.snapshots[sub] = { data, updatedAt }; this.write(d); }
  async deleteUser(sub: string) { const d = this.read(); delete d.users[sub]; delete d.auth[sub]; delete d.snapshots[sub]; this.write(d); }
}

let instance: Store | null = null;
export function db(): Store {
  if (!instance) instance = process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new FileStore();
  return instance;
}

export const cloudEnabled = () => true; // accounts always available; storage backend chosen above
