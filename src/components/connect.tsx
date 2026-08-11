"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, Plug, RefreshCw, TriangleAlert, Watch } from "lucide-react";
import { Card } from "@/components/ui";
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
  const [busy, setBusy] = useState<"sync" | "save" | null>(null);
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
      setMessage({ kind: "ok", text: `Synced ${r.count} days from Fitbit.` });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error && e.message === "not_connected" ? "Not connected yet." : "Sync failed — try reconnecting." });
    } finally {
      setBusy(null);
    }
  }, [setWearableDays]);

  const saveClientId = useCallback(async (id: string) => {
    setBusy("save");
    const r = await fetch("/api/fitbit/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id }),
    }).catch(() => null);
    setBusy(null);
    if (!r?.ok) {
      setMessage({ kind: "err", text: "That doesn't look like a valid Client ID." });
      return false;
    }
    window.location.href = "/api/fitbit/connect";
    return true;
  }, []);

  const disconnect = useCallback(async () => {
    await fetch("/api/fitbit/disconnect", { method: "POST" }).catch(() => {});
    refresh();
  }, [refresh]);

  return { status, busy, message, sync, saveClientId, disconnect, refresh, setMessage };
}

/** Full connect card: setup steps, Client ID entry, connect + sync actions. */
export function FitbitCard({ autoSyncOnConnected = false }: { autoSyncOnConnected?: boolean }) {
  const { status, busy, message, sync, saveClientId, disconnect } = useFitbit();
  const lastSync = useApp((s) => s.lastSync);
  const connectedData = useApp((s) => s.wearableDays.length > 0);
  const [clientId, setClientId] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const p = new URLSearchParams(window.location.search);
    if (p.get("fitbit") === "connected" && autoSyncOnConnected) {
      sync();
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redirect = `${origin}/api/fitbit/callback`;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-recovery/10 text-recovery">
          <Watch size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-50">Fitbit</h3>
            {status?.connected ? (
              <span className="flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-semibold text-good">
                <CheckCircle2 size={10} /> Connected
              </span>
            ) : (
              <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold text-ink-300">Not connected</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Sleep, HRV, resting HR, workouts, steps and calories from your Fitbit account — synced on demand, stored
            only in this browser.
          </p>

          {status && !status.connected && (
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              {!status.envConfigured && (
                <>
                  <p className="text-xs leading-relaxed text-ink-300">
                    One-time setup (~2 min): create a free app at{" "}
                    <a href="https://dev.fitbit.com/apps/new" target="_blank" rel="noreferrer" className="text-nutrition hover:underline">
                      dev.fitbit.com/apps/new
                    </a>{" "}
                    — OAuth 2.0 Application Type <span className="font-semibold text-ink-100">Client</span>, Redirect URL:
                  </p>
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-ink-900 px-2.5 py-1.5">
                    <code className="min-w-0 flex-1 truncate text-[11px] text-ink-200">{redirect}</code>
                    <button onClick={() => navigator.clipboard?.writeText(redirect)} className="shrink-0 text-ink-400 hover:text-ink-100" title="Copy">
                      <Copy size={12} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <input
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Paste Client ID (e.g. 23ABCD)"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-white/12 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-white/25"
                    />
                    <button
                      onClick={() => saveClientId(clientId)}
                      disabled={!clientId.trim() || busy !== null}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-recovery px-4 text-xs font-semibold text-ink-950 disabled:opacity-40"
                    >
                      {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Connect
                    </button>
                  </div>
                </>
              )}
              {status.envConfigured && (
                <button
                  onClick={() => (window.location.href = "/api/fitbit/connect")}
                  className="flex items-center gap-1.5 rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-ink-950"
                >
                  <Plug size={13} /> Connect Fitbit
                </button>
              )}
            </div>
          )}

          {status?.connected && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={sync}
                disabled={busy !== null}
                className="flex items-center gap-1.5 rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-ink-950 disabled:opacity-50"
              >
                <RefreshCw size={13} className={busy === "sync" ? "animate-spin" : ""} /> Sync now
              </button>
              <button onClick={disconnect} className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-white/[0.06]">
                Disconnect
              </button>
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
