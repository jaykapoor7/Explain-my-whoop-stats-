"use client";

import { useCallback, useEffect, useState } from "react";
import { Apple, Check, Link2, RefreshCw, Watch } from "lucide-react";
import { Card } from "@/components/ui";
import { useApp } from "@/lib/data/store";
import { cn } from "@/lib/format";

interface P { id: string; name: string; color: string; tagline: string; configured: boolean; connected: boolean; mapped: boolean; }

export function Connections() {
  const setWearableDays = useApp((s) => s.setWearableDays);
  const [providers, setProviders] = useState<P[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/connect/status", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setProviders(((await r.json()) as { providers: P[] }).providers);
    else setProviders([]);
  }, []);

  const sync = useCallback(async (id: string) => {
    setBusy(id); setMsg(null);
    const r = await fetch(`/api/connect/${id}/sync`, { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { days?: [] ; count?: number } | null;
    if (r?.ok && j?.days) { setWearableDays(j.days, new Date().toISOString()); setMsg({ id, text: `Synced ${j.count} days.`, ok: true }); }
    else setMsg({ id, text: "Couldn't sync — try reconnecting.", ok: false });
    setBusy(null);
  }, [setWearableDays]);

  useEffect(() => { refresh(); }, [refresh]);

  // After an OAuth connect redirect (?connected=<id>), sync once automatically.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("connected");
    if (c) { sync(c); window.history.replaceState({}, "", "/settings"); }
  }, [sync]);

  const disconnect = async (id: string) => {
    await fetch(`/api/connect/${id}/disconnect`, { method: "POST" }).catch(() => {});
    refresh();
  };

  return (
    <div className="space-y-2.5">
      {(providers ?? []).map((p) => (
        <Card key={p.id} className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${p.color}1f`, color: p.color }}><Watch size={17} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-50">
              {p.name}
              {p.connected && <span className="flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-semibold text-good"><Check size={9} /> Connected</span>}
            </div>
            <div className="text-[11px] text-ink-400">{p.tagline}{!p.mapped && p.configured ? " · mapping in progress" : ""}</div>
          </div>
          {p.connected ? (
            <div className="flex items-center gap-2">
              <button onClick={() => sync(p.id)} disabled={busy === p.id} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: p.color }}>
                <RefreshCw size={12} className={busy === p.id ? "animate-spin" : ""} /> Sync
              </button>
              <button onClick={() => disconnect(p.id)} className="rounded-full border border-black/15 px-3 py-2 text-xs font-medium text-ink-300 hover:bg-black/[0.05]">Disconnect</button>
            </div>
          ) : p.configured ? (
            <button onClick={() => (window.location.href = `/api/connect/${p.id}`)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ background: p.color }}>
              <Link2 size={13} /> Connect
            </button>
          ) : (
            <span className="rounded-full bg-black/[0.05] px-3 py-1.5 text-[11px] font-medium text-ink-500">Coming soon</span>
          )}
          {msg?.id === p.id && <p className={cn("w-full text-[11px]", msg.ok ? "text-good" : "text-bad")}>{msg.text}</p>}
        </Card>
      ))}

      {/* Apple — no web API; needs the native app. */}
      <Card className="flex items-center gap-3 p-4 opacity-80">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.06] text-ink-300"><Apple size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink-50">Apple Watch</div>
          <div className="text-[11px] text-ink-400">Apple Health has no web API — coming via the CURA iOS app.</div>
        </div>
        <span className="rounded-full bg-black/[0.05] px-3 py-1.5 text-[11px] font-medium text-ink-500">Via the app</span>
      </Card>

      {providers === null && <div className="skeleton h-20 rounded-2xl" />}
    </div>
  );
}
