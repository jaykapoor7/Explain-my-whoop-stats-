import "server-only";
import crypto from "crypto";
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

// ---- Social (friend groups / leaderboards) ----
export interface Group { id: string; name: string; code: string; ownerSub: string; }
export interface PublishScores {
  recovery: number | null; sleep: number | null; strain: number | null; sleepHours: number | null; day: string;
  // 7-day averages, for the weekly leaderboard.
  recovery7?: number | null; sleep7?: number | null; strain7?: number | null;
}
export interface MemberScore extends PublishScores { sub: string; name?: string; picture?: string; }

const code6 = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 6; i++) s += a[crypto.randomInt(a.length)];
  return s;
};
const newId = () => crypto.randomBytes(9).toString("base64url");

export interface Store {
  upsertUser(u: UserRow): Promise<void>;
  getUser(sub: string): Promise<UserRow | null>;
  saveGoogleAuth(sub: string, encryptedRefresh: string): Promise<void>;
  getGoogleAuth(sub: string): Promise<string | null>;
  getSnapshot(sub: string): Promise<{ data: string; updatedAt: number } | null>;
  saveSnapshot(sub: string, data: string, updatedAt: number): Promise<void>;
  deleteUser(sub: string): Promise<void>;
  // social
  createGroup(ownerSub: string, name: string): Promise<Group>;
  findGroupByCode(code: string): Promise<Group | null>;
  getGroup(id: string): Promise<Group | null>;
  addMember(groupId: string, sub: string): Promise<void>;
  removeMember(groupId: string, sub: string): Promise<void>;
  isMember(groupId: string, sub: string): Promise<boolean>;
  listGroups(sub: string): Promise<Group[]>;
  memberScores(groupId: string): Promise<MemberScore[]>;
  publishScores(sub: string, s: PublishScores): Promise<void>;
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
      CREATE TABLE IF NOT EXISTS social_groups (
        id text PRIMARY KEY, name text NOT NULL, code text UNIQUE NOT NULL,
        owner_sub text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS social_members (
        group_id text NOT NULL REFERENCES social_groups(id) ON DELETE CASCADE,
        sub text NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (group_id, sub)
      );
      CREATE TABLE IF NOT EXISTS social_scores (
        sub text PRIMARY KEY, recovery int, sleep int, strain real,
        sleep_hours real, day text, updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE social_scores ADD COLUMN IF NOT EXISTS recovery7 int;
      ALTER TABLE social_scores ADD COLUMN IF NOT EXISTS sleep7 int;
      ALTER TABLE social_scores ADD COLUMN IF NOT EXISTS strain7 real;
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
    await this.pool.query("DELETE FROM social_members WHERE sub=$1", [sub]);
    await this.pool.query("DELETE FROM social_scores WHERE sub=$1", [sub]);
    await this.pool.query("DELETE FROM users WHERE sub=$1", [sub]);
  }
  async createGroup(ownerSub: string, name: string) {
    await this.ready;
    for (let i = 0; i < 6; i++) {
      const g: Group = { id: newId(), name: name.slice(0, 40), code: code6(), ownerSub };
      try {
        await this.pool.query("INSERT INTO social_groups (id, name, code, owner_sub) VALUES ($1,$2,$3,$4)", [g.id, g.name, g.code, g.ownerSub]);
        await this.pool.query("INSERT INTO social_members (group_id, sub) VALUES ($1,$2) ON CONFLICT DO NOTHING", [g.id, ownerSub]);
        return g;
      } catch { /* code collision — retry */ }
    }
    throw new Error("could not create group");
  }
  async findGroupByCode(code: string) {
    await this.ready;
    const r = await this.pool.query("SELECT id, name, code, owner_sub FROM social_groups WHERE code=$1", [code.toUpperCase()]);
    const row = r.rows[0];
    return row ? { id: row.id, name: row.name, code: row.code, ownerSub: row.owner_sub } : null;
  }
  async getGroup(id: string) {
    await this.ready;
    const r = await this.pool.query("SELECT id, name, code, owner_sub FROM social_groups WHERE id=$1", [id]);
    const row = r.rows[0];
    return row ? { id: row.id, name: row.name, code: row.code, ownerSub: row.owner_sub } : null;
  }
  async addMember(groupId: string, sub: string) {
    await this.ready;
    await this.pool.query("INSERT INTO social_members (group_id, sub) VALUES ($1,$2) ON CONFLICT DO NOTHING", [groupId, sub]);
  }
  async removeMember(groupId: string, sub: string) {
    await this.ready;
    await this.pool.query("DELETE FROM social_members WHERE group_id=$1 AND sub=$2", [groupId, sub]);
    // If the group is now empty, clean it up.
    const c = await this.pool.query("SELECT count(*)::int AS n FROM social_members WHERE group_id=$1", [groupId]);
    if ((c.rows[0]?.n ?? 0) === 0) await this.pool.query("DELETE FROM social_groups WHERE id=$1", [groupId]);
  }
  async isMember(groupId: string, sub: string) {
    await this.ready;
    const r = await this.pool.query("SELECT 1 FROM social_members WHERE group_id=$1 AND sub=$2", [groupId, sub]);
    return r.rows.length > 0;
  }
  async listGroups(sub: string) {
    await this.ready;
    const r = await this.pool.query(
      `SELECT g.id, g.name, g.code, g.owner_sub FROM social_groups g
       JOIN social_members m ON m.group_id = g.id WHERE m.sub=$1 ORDER BY g.created_at`,
      [sub]
    );
    return r.rows.map((row) => ({ id: row.id, name: row.name, code: row.code, ownerSub: row.owner_sub }));
  }
  async memberScores(groupId: string) {
    await this.ready;
    const r = await this.pool.query(
      `SELECT m.sub, u.name, u.picture, s.recovery, s.sleep, s.strain, s.sleep_hours, s.day, s.recovery7, s.sleep7, s.strain7
       FROM social_members m
       LEFT JOIN users u ON u.sub = m.sub
       LEFT JOIN social_scores s ON s.sub = m.sub
       WHERE m.group_id=$1`,
      [groupId]
    );
    return r.rows.map((row) => ({
      sub: row.sub, name: row.name ?? undefined, picture: row.picture ?? undefined,
      recovery: row.recovery, sleep: row.sleep, strain: row.strain, sleepHours: row.sleep_hours, day: row.day,
      recovery7: row.recovery7, sleep7: row.sleep7, strain7: row.strain7,
    }));
  }
  async publishScores(sub: string, s: PublishScores) {
    await this.ready;
    await this.pool.query(
      `INSERT INTO social_scores (sub, recovery, sleep, strain, sleep_hours, day, recovery7, sleep7, strain7, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT (sub) DO UPDATE SET recovery=EXCLUDED.recovery, sleep=EXCLUDED.sleep,
         strain=EXCLUDED.strain, sleep_hours=EXCLUDED.sleep_hours, day=EXCLUDED.day,
         recovery7=EXCLUDED.recovery7, sleep7=EXCLUDED.sleep7, strain7=EXCLUDED.strain7, updated_at=now()`,
      [sub, s.recovery, s.sleep, s.strain, s.sleepHours, s.day, s.recovery7 ?? null, s.sleep7 ?? null, s.strain7 ?? null]
    );
  }
}

// ---------------- JSON file fallback ----------------

interface FileShape {
  users: Record<string, UserRow>;
  auth: Record<string, string>;
  snapshots: Record<string, { data: string; updatedAt: number }>;
  groups?: Record<string, Group & { members: string[] }>;
  scores?: Record<string, PublishScores>;
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
  async deleteUser(sub: string) {
    const d = this.read();
    delete d.users[sub]; delete d.auth[sub]; delete d.snapshots[sub];
    if (d.scores) delete d.scores[sub];
    for (const g of Object.values(d.groups ?? {})) g.members = g.members.filter((m) => m !== sub);
    this.write(d);
  }
  async createGroup(ownerSub: string, name: string) {
    const d = this.read();
    d.groups ??= {};
    const codes = new Set(Object.values(d.groups).map((g) => g.code));
    let code = code6(); while (codes.has(code)) code = code6();
    const g: Group = { id: newId(), name: name.slice(0, 40), code, ownerSub };
    d.groups[g.id] = { ...g, members: [ownerSub] };
    this.write(d);
    return g;
  }
  async findGroupByCode(code: string) {
    const g = Object.values(this.read().groups ?? {}).find((x) => x.code === code.toUpperCase());
    return g ? { id: g.id, name: g.name, code: g.code, ownerSub: g.ownerSub } : null;
  }
  async getGroup(id: string) {
    const g = this.read().groups?.[id];
    return g ? { id: g.id, name: g.name, code: g.code, ownerSub: g.ownerSub } : null;
  }
  async addMember(groupId: string, sub: string) {
    const d = this.read(); const g = d.groups?.[groupId];
    if (g && !g.members.includes(sub)) { g.members.push(sub); this.write(d); }
  }
  async removeMember(groupId: string, sub: string) {
    const d = this.read(); const g = d.groups?.[groupId];
    if (!g) return;
    g.members = g.members.filter((m) => m !== sub);
    if (g.members.length === 0) delete d.groups![groupId];
    this.write(d);
  }
  async isMember(groupId: string, sub: string) {
    return !!this.read().groups?.[groupId]?.members.includes(sub);
  }
  async listGroups(sub: string) {
    return Object.values(this.read().groups ?? {})
      .filter((g) => g.members.includes(sub))
      .map((g) => ({ id: g.id, name: g.name, code: g.code, ownerSub: g.ownerSub }));
  }
  async memberScores(groupId: string) {
    const d = this.read(); const g = d.groups?.[groupId];
    if (!g) return [];
    return g.members.map((sub) => {
      const u = d.users[sub]; const s = d.scores?.[sub];
      return {
        sub, name: u?.name, picture: u?.picture,
        recovery: s?.recovery ?? null, sleep: s?.sleep ?? null, strain: s?.strain ?? null,
        sleepHours: s?.sleepHours ?? null, day: s?.day ?? "",
        recovery7: s?.recovery7 ?? null, sleep7: s?.sleep7 ?? null, strain7: s?.strain7 ?? null,
      } as MemberScore;
    });
  }
  async publishScores(sub: string, s: PublishScores) {
    const d = this.read(); d.scores ??= {}; d.scores[sub] = s; this.write(d);
  }
}

let instance: Store | null = null;
export function db(): Store {
  if (!instance) instance = process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new FileStore();
  return instance;
}

export const cloudEnabled = () => true; // accounts always available; storage backend chosen above
