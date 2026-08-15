"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Cloud, LogIn, Loader2 } from "lucide-react";
import { useApp, collectSyncState } from "@/lib/data/store";

export interface AccountUser { sub: string; email?: string; name?: string; picture?: string; }
interface AccountState {
  loading: boolean;
  signedIn: boolean;
  user: AccountUser | null;
  syncing: boolean;
  /** false = no database on this deployment, so cross-device sync can't work. */
  syncDurable: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AccountState | null>(null);
export const useAccount = () => useContext(Ctx)!;

const DEBOUNCE_MS = 1500;

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDurable, setSyncDurable] = useState(true); // optimistic until the server says otherwise

  const lastSig = useRef<string>("");   // signature of what the cloud has
  const applying = useRef(false);       // true while importing a cloud snapshot
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/session", { cache: "no-store" });
      const j = (await r.json()) as { signedIn: boolean; user?: AccountUser };
      setSignedIn(j.signedIn);
      setUser(j.user ?? null);
    } catch {
      setSignedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const push = useCallback(async () => {
    const data = collectSyncState(useApp.getState());
    const sig = JSON.stringify(data);
    if (sig === lastSig.current) return;
    setSyncing(true);
    const updatedAt = Date.now();
    const r = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, updatedAt }),
    }).catch(() => null);
    if (r?.ok) {
      lastSig.current = sig;
      useApp.getState().markCloudSynced(updatedAt);
    }
    setSyncing(false);
  }, []);

  // Initial pull-or-push once signed in, then keep pushing local changes.
  useEffect(() => {
    if (!signedIn) return;
    let disposed = false;
    (async () => {
      // Wait until the local store has hydrated from localStorage, so we never
      // push empty defaults over good cloud data (or mis-judge "local is newer").
      for (let i = 0; i < 40 && !useApp.getState().hydrated; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (disposed) return;
      }
      setSyncing(true);
      try {
        const r = await fetch("/api/data", { cache: "no-store" });
        const j = (await r.json()) as { data: string | null; updatedAt: number; durable?: boolean };
        setSyncDurable(j.durable !== false);
        // Always UNION-merge the cloud snapshot when it exists. hydrateFromCloud
        // never drops local data, so merging is safe regardless of which device's
        // clock produced `updatedAt` — cross-device clocks can't be compared
        // reliably. The old `updatedAt > localTs` gate meant that with even small
        // clock skew a device would treat genuinely-newer cloud data as older,
        // skip the merge, and overwrite the cloud with its own snapshot — silently
        // losing the other device's journal / tasks / goals. Merge first, then push
        // the union so the cloud converges to everything this device now holds.
        if (j.data) {
          applying.current = true;
          const parsed = JSON.parse(j.data) as Record<string, unknown>;
          useApp.getState().hydrateFromCloud(parsed, Math.max(j.updatedAt, useApp.getState().cloudUpdatedAt));
          applying.current = false;
        }
        lastSig.current = ""; // force one reconciling push of the merged union
        await push();
      } catch { /* offline — try again on next change */ }
      if (!disposed) setSyncing(false);
    })();

    const unsub = useApp.subscribe(() => {
      if (applying.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(push, DEBOUNCE_MS);
    });
    return () => { disposed = true; unsub(); if (timer.current) clearTimeout(timer.current); };
  }, [signedIn, push]);

  // Pull newer cloud data when the tab regains focus / periodically, so a
  // change made on another device (e.g. logging a med on your laptop) shows up
  // here without a manual reload. Skips if this device has unpushed edits.
  const pullRemote = useCallback(async () => {
    if (applying.current || !useApp.getState().hydrated) return;
    const cur = JSON.stringify(collectSyncState(useApp.getState()));
    if (cur !== lastSig.current) return; // local has pending changes; let the push win
    const r = await fetch("/api/data", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const j = (await r.json()) as { data: string | null; updatedAt: number };
    // Merge whenever the cloud's snapshot differs from what we last saw — NOT
    // gated on `>` (cross-device clock skew makes a genuinely-newer write look
    // older). The merge is a union, so re-applying is harmless, and pullRemote
    // never pushes, so this can't loop.
    if (j.data && j.updatedAt !== useApp.getState().cloudUpdatedAt) {
      applying.current = true;
      useApp.getState().hydrateFromCloud(JSON.parse(j.data), j.updatedAt);
      lastSig.current = JSON.stringify(collectSyncState(useApp.getState()));
      applying.current = false;
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const onVis = () => { if (document.visibilityState === "visible") pullRemote(); };
    window.addEventListener("focus", pullRemote);
    document.addEventListener("visibilitychange", onVis);
    const iv = setInterval(pullRemote, 45000);
    return () => {
      window.removeEventListener("focus", pullRemote);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(iv);
    };
  }, [signedIn, pullRemote]);

  const signIn = useCallback(() => { window.location.href = "/api/fitbit/connect"; }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    setSignedIn(false);
    setUser(null);
    lastSig.current = "";
    useApp.getState().resetAll();
  }, []);

  const deleteAccount = useCallback(async () => {
    await fetch("/api/account/delete", { method: "POST" }).catch(() => {});
    setSignedIn(false);
    setUser(null);
    lastSig.current = "";
    useApp.getState().resetAll();
  }, []);

  return (
    <Ctx.Provider value={{ loading, signedIn, user, syncing, syncDurable, signIn, signOut, deleteAccount, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

function initials(u: AccountUser) {
  const s = (u.name || u.email || "You").trim();
  return s.slice(0, 1).toUpperCase();
}

/** Compact account row for the sidebar footer / mobile menu. */
export function AccountChip({ compact = false }: { compact?: boolean }) {
  const { loading, signedIn, user, syncing, signIn } = useAccount();
  if (loading) return <div className="skeleton h-10 rounded-xl" />;

  if (!signedIn) {
    return (
      <button
        onClick={signIn}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-recovery px-3 py-2.5 text-[13px] font-semibold text-[#241f18] shadow-lift transition hover:brightness-[1.03]"
      >
        <LogIn size={15} /> Sign in with Google
      </button>
    );
  }
  const u = user!;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-black/[0.02] px-2.5 py-2">
      {u.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-recovery/20 text-xs font-bold text-recovery">{initials(u)}</span>
      )}
      {!compact && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-ink-100">{u.name || "Signed in"}</div>
          <div className="flex items-center gap-1 text-[10px] text-ink-500">
            {syncing ? <><Loader2 size={9} className="animate-spin" /> syncing…</> : <><Cloud size={9} /> synced</>}
          </div>
        </div>
      )}
    </div>
  );
}
