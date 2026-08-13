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
  signIn: () => void;
  signOut: () => Promise<void>;
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
      setSyncing(true);
      try {
        const r = await fetch("/api/data", { cache: "no-store" });
        const j = (await r.json()) as { data: string | null; updatedAt: number };
        const localTs = useApp.getState().cloudUpdatedAt;
        if (j.data && j.updatedAt > localTs) {
          applying.current = true;
          const parsed = JSON.parse(j.data) as Record<string, unknown>;
          useApp.getState().hydrateFromCloud(parsed, j.updatedAt);
          lastSig.current = JSON.stringify(collectSyncState(useApp.getState()));
          applying.current = false;
        } else {
          // Local is newer (or cloud empty) — seed the cloud from this device.
          lastSig.current = ""; // force a push
          await push();
        }
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

  const signIn = useCallback(() => { window.location.href = "/api/fitbit/connect"; }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    setSignedIn(false);
    setUser(null);
    lastSig.current = "";
    useApp.getState().resetAll();
  }, []);

  return (
    <Ctx.Provider value={{ loading, signedIn, user, syncing, signIn, signOut, refresh }}>
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
