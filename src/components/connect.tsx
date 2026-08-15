"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LogIn, RefreshCw, Smartphone, TriangleAlert, Watch } from "lucide-react";
import { Card } from "@/components/ui";
import { AddDeviceButton } from "@/components/device-pairing";
import { useAccount } from "@/components/account";
import { useApp } from "@/lib/data/store";
import { syncWearable } from "@/lib/data/provider";

interface FitbitStatus {
  configured: boolean;
  connected: boolean;
  envConfigured: boolean;
}

export function useFitbit() {
  const setWearableDays = useApp((s) => s.setWearableDays);
  const [status, setStatus] = useState<FitbitStatus | null>(null);
  const [busy, setBusy] = useState<"sync" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/fitbit/status", { cache: "no-store" });
      setStatus((await r.json()) as FitbitStatus);
    } catch {
      setStatus({ configured: false, connected: false, envConfigured: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sync = useCallback(async () => {
    setBusy("sync");
    setMessage(null);
    try {
      const r = await syncWearable();
      setWearableDays(r.days, r.syncedAt);
      setMessage({ kind: "ok", text: `Synced ${r.count} days.` });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error && e.message === "not_connected" ? "Not connected yet." : "Sync failed — try reconnecting." });
    } finally {
      setBusy(null);
    }
  }, [setWearableDays]);

  const disconnect = useCallback(async () => {
    await fetch("/api/fitbit/disconnect", { method: "POST" }).catch(() => {});
    refresh();
  }, [refresh]);

  return { status, busy, message, sync, disconnect, refresh, setMessage };
}

/** Connect card: one-tap sign-in, sync, add device, disconnect. */
export function FitbitCard({ autoSyncOnConnected = false }: { autoSyncOnConnected?: boolean }) {
  const { status, busy, message, sync, disconnect } = useFitbit();
  const account = useAccount();
  const lastSync = useApp((s) => s.lastSync);
  const connectedData = useApp((s) => s.wearableDays.length > 0);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if ((p.get("fitbit") === "connected" || p.get("paired") === "1") && autoSyncOnConnected) {
      sync();
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-recovery/10 text-recovery">
          <Watch size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-50">Fitbit &amp; Google Health</h3>
            {status?.connected ? (
              <span className="flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-semibold text-good">
                <CheckCircle2 size={10} /> Connected
              </span>
            ) : (
              <span className="rounded-full bg-black/[0.07] px-2 py-0.5 text-[10px] font-semibold text-ink-300">Not connected</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            {account.signedIn && account.user?.email ? (
              <>Signed in as <span className="font-medium text-ink-200">{account.user.email}</span>. </>
            ) : null}
            Sleep, HRV, resting heart rate, workouts, steps, calories and weight — synced to every device you sign in on.
          </p>

          {/* --- Not connected: connect this device --- */}
          {status && !status.connected && (
            <div className="mt-3">
              <button
                onClick={() => (window.location.href = "/api/fitbit/connect")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-recovery px-4 py-3 text-sm font-semibold text-[#241f18] shadow-lift transition hover:brightness-[1.03] sm:w-auto"
              >
                <LogIn size={15} /> Sign in with Google
              </button>
              <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-500">
                <Smartphone size={13} className="mt-0.5 shrink-0" />
                <p>
                  Sign in with the same Google account on any device and everything is already there. Or, from a
                  connected device, use <span className="font-medium text-ink-400">Add a device</span> to scan a QR.
                </p>
              </div>
            </div>
          )}

          {/* --- Connected: sync, add device, disconnect --- */}
          {status?.connected && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={sync}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-[#241f18] disabled:opacity-50"
              >
                <RefreshCw size={13} className={busy === "sync" ? "animate-spin" : ""} /> Sync now
              </button>
              <AddDeviceButton />
              {account.signedIn ? (
                <button onClick={() => account.signOut()} className="rounded-full border border-black/15 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-black/[0.06]">
                  Sign out
                </button>
              ) : (
                <button onClick={disconnect} className="rounded-full border border-black/15 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-black/[0.06]">
                  Disconnect
                </button>
              )}
              {lastSync && <span className="text-[11px] text-ink-500">last sync {new Date(lastSync).toLocaleString()}</span>}
            </div>
          )}

          {message && (
            <p className={`mt-2.5 flex items-center gap-1.5 text-xs ${message.kind === "ok" ? "text-good" : "text-bad"}`}>
              {message.kind === "ok" ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />} {message.text}
            </p>
          )}
          {!connectedData && status?.connected && !message && (
            <p className="mt-2 text-[11px] text-ink-500">Connected — run your first sync to pull the last 30 days.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Gate shown on score pages until wearable data exists. */
export function ConnectGate({ title }: { title: string }) {
  return (
    <div className="mt-5 space-y-4">
      <Card className="p-5 text-center">
        <p className="text-sm font-semibold text-ink-100">No wearable data yet</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-400">
          {title} is computed from your Fitbit data. Connect your account below and sync — scores, baselines and
          explanations appear immediately after.
        </p>
      </Card>
      <FitbitCard autoSyncOnConnected />
    </div>
  );
}
