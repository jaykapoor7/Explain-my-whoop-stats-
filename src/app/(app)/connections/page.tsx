"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Badge, Button, Card, FadeIn, SectionHeading } from "@/components/ui";
import {
  ConnectionStatus,
  EXPORT_PROVIDERS,
  OAUTH_PROVIDERS,
  ProviderInfo,
} from "@/lib/connections/registry";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

type SyncState = "idle" | "connecting" | "syncing" | "done" | "error";

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ProviderLogo({ p, size = 11 }: { p: ProviderInfo; size?: number }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg"
      style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}99)` }}
    >
      {p.name.slice(0, 2)}
    </span>
  );
}

/** Inline connect form: PAT (easiest) and/or in-app OAuth credentials. */
function ConnectPanel({
  p,
  origin,
  onPatConnected,
  onClose,
}: {
  p: ProviderInfo;
  origin: string;
  onPatConnected: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"pat" | "oauth">(p.supportsPat ? "pat" : "oauth");
  const [pat, setPat] = useState("");
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const redirect = `${origin}/api/oauth/${p.id}/callback`;

  const savePat = async () => {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/connections/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p.id, accessToken: pat.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return setErr("Couldn't save that token. Double-check it and try again.");
    onPatConnected();
  };

  const saveOauth = async () => {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/connections/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p.id, clientId: clientId.trim(), clientSecret: secret.trim() || undefined }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setBusy(false);
      return setErr("Couldn't save credentials. Check the fields and try again.");
    }
    // Credentials saved server-side — kick off the OAuth redirect.
    window.location.href = `/api/oauth/${p.id}/start`;
  };

  const field =
    "h-10 w-full rounded-lg border border-white/12 bg-base-900 px-3 text-sm outline-none focus:border-accent/60";

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <Card className="gradient-ring mb-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <ProviderLogo p={p} /> Connect {p.name}
          </h3>
          <button onClick={onClose} className="text-base-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {p.supportsPat && (
          <div className="mt-4 flex gap-1.5">
            <button
              onClick={() => setMode("pat")}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "pat" ? "bg-white text-base-950" : "border border-white/12 text-base-300 hover:bg-white/[0.08]")}
            >
              Personal token · easiest
            </button>
            <button
              onClick={() => setMode("oauth")}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition", mode === "oauth" ? "bg-white text-base-950" : "border border-white/12 text-base-300 hover:bg-white/[0.08]")}
            >
              OAuth app
            </button>
          </div>
        )}

        {mode === "pat" && p.supportsPat ? (
          <div className="mt-4">
            <p className="text-sm text-base-300">
              Generate a token at{" "}
              <a href={p.patUrl} target="_blank" rel="noreferrer" className="text-accent-soft hover:underline">
                {p.patUrl?.replace("https://", "")}
              </a>{" "}
              and paste it below. That&apos;s it — no app, no Vercel.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="Paste your Personal Access Token"
                className={field}
                type="password"
              />
              <Button onClick={savePat} disabled={busy || !pat.trim()} className="shrink-0">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Connect
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-base-300">{p.credHint}</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
              <span className="shrink-0 text-base-400">Redirect URL:</span>
              <code className="min-w-0 flex-1 truncate text-base-200">{redirect}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(redirect)}
                className="shrink-0 text-base-400 hover:text-white"
                title="Copy"
              >
                <Copy size={13} />
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" className={field} />
              {p.secretRequired && (
                <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Client Secret" className={field} type="password" />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <a href={p.devConsole} target="_blank" rel="noreferrer" className="text-xs text-accent-soft hover:underline">
                Open {p.name} developer console →
              </a>
              <Button onClick={saveOauth} disabled={busy || !clientId.trim() || (p.secretRequired && !secret.trim())}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Save &amp; connect
              </Button>
            </div>
          </div>
        )}

        {err && <p className="mt-3 flex items-center gap-1.5 text-xs text-[#ffa2b0]"><TriangleAlert size={13} /> {err}</p>}
      </Card>
    </motion.div>
  );
}

function OAuthCard({
  p,
  status,
  state,
  message,
  onConnect,
  onSync,
  onDisconnect,
  lastSync,
  dayCount,
}: {
  p: ProviderInfo;
  status?: ConnectionStatus;
  state: SyncState;
  message?: string;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  lastSync?: string;
  dayCount?: number;
}) {
  const connected = status?.connected;
  const busy = state === "connecting" || state === "syncing";

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
      <Card className="relative flex h-full flex-col overflow-hidden p-5">
        <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-3xl" style={{ background: p.color }} />
        <div className="flex items-start gap-3">
          <ProviderLogo p={p} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{p.name}</h3>
              {connected ? (
                <Badge tone="good"><CheckCircle2 size={11} /> Connected</Badge>
              ) : (
                <Badge tone="neutral">Not connected</Badge>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-base-400">{p.provides}</p>
          </div>
        </div>

        <div className="mt-3 flex-1 text-xs leading-relaxed text-base-400">
          {connected ? (
            <span>
              Auto-syncs when you open the app.
              {lastSync && <> Last sync <span className="text-base-200">{timeAgo(lastSync)}</span>{dayCount ? ` · ${dayCount} days` : ""}.</>}
            </span>
          ) : (
            <span>{p.note}</span>
          )}
        </div>

        <AnimatePresence>
          {busy && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex items-center gap-2 text-xs text-accent-soft">
              <Loader2 size={13} className="animate-spin" />
              {state === "connecting" ? "Opening authorization…" : "Syncing your data…"}
            </motion.div>
          )}
          {state === "done" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center gap-2 text-xs text-[#6ee7b7]">
              <CheckCircle2 size={13} /> {message ?? "Synced"}
            </motion.div>
          )}
          {state === "error" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-start gap-2 text-xs text-[#ffa2b0]">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" /> {message ?? "Something went wrong"}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex items-center gap-2">
          {connected ? (
            <>
              <Button size="sm" onClick={onSync} disabled={busy}>
                <RefreshCw size={13} className={state === "syncing" ? "animate-spin" : ""} /> Sync now
              </Button>
              <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={busy}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConnect} disabled={busy}>
              <Plug size={13} /> Connect {p.name}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function ConnectionsBody() {
  const router = useRouter();
  const params = useSearchParams();
  const mergeSynced = useApp((s) => s.mergeSynced);
  const syncedSources = useApp((s) => s.syncedSources);

  const [statuses, setStatuses] = useState<ConnectionStatus[]>([]);
  const [states, setStates] = useState<Record<string, { state: SyncState; message?: string }>>({});
  const [formProvider, setFormProvider] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const setState = (id: string, state: SyncState, message?: string) => setStates((s) => ({ ...s, [id]: { state, message } }));

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      const json = await res.json();
      setStatuses(json.providers ?? []);
    } catch {
      setStatuses(OAUTH_PROVIDERS.map((p) => ({ id: p.id, configured: false, hasClientId: false, connected: false })));
    }
  }, []);

  const runSync = useCallback(
    async (id: string) => {
      const label = OAUTH_PROVIDERS.find((p) => p.id === id)?.name ?? id;
      setState(id, "syncing");
      try {
        const res = await fetch(`/api/sync/${id}`, { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setState(id, "error", err.error === "not_connected" ? "Not connected." : "Sync failed — try reconnecting.");
          return;
        }
        const json = await res.json();
        const added = mergeSynced(json.days ?? [], id, json.label ?? label);
        setState(id, "done", `${json.count} days pulled${added ? `, ${added} new` : ""}.`);
      } catch {
        setState(id, "error", "Network error during sync.");
      }
    },
    [mergeSynced]
  );

  useEffect(() => {
    setOrigin(window.location.origin);
    loadStatus();
    const connected = params.get("connected");
    const setup = params.get("setup");
    const error = params.get("error");
    if (connected) runSync(connected).then(loadStatus);
    if (setup) setFormProvider(setup);
    if (error) {
      const [prov, reason] = error.split(":");
      setState(prov, "error", reason === "denied" ? "Authorization was cancelled." : "Connection failed.");
      setFormProvider(prov);
    }
    if (connected || setup || error) router.replace("/connections");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = (id: string) => {
    const status = statuses.find((s) => s.id === id);
    // Already has credentials saved → straight to OAuth. Otherwise open the form.
    if (status?.configured) {
      setState(id, "connecting");
      window.location.href = `/api/oauth/${id}/start`;
    } else {
      setFormProvider(formProvider === id ? null : id);
    }
  };

  const disconnect = async (id: string) => {
    await fetch(`/api/connections/credentials?provider=${id}`, { method: "DELETE" }).catch(() => {});
    setState(id, "idle");
    loadStatus();
  };

  const syncedByProvider = useMemo(() => Object.fromEntries(syncedSources.map((s) => [s.provider, s])), [syncedSources]);
  const openProvider = OAUTH_PROVIDERS.find((p) => p.id === formProvider);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connect a device</h1>
          <p className="mt-1 max-w-2xl text-sm text-base-400">
            Link a wearable and your data syncs automatically. Paste a token or key right here — no environment
            variables, no redeploys. Everything stays in a secure cookie on your side.
          </p>
        </div>
        <Link href="/upload" className="text-sm font-medium text-accent-soft hover:underline">
          Upload files instead →
        </Link>
      </div>

      <SectionHeading title="Auto-sync wearables" subtitle="Connect once — syncs every visit" />
      <AnimatePresence>
        {openProvider && (
          <ConnectPanel
            key={openProvider.id}
            p={openProvider}
            origin={origin}
            onPatConnected={() => {
              setFormProvider(null);
              runSync(openProvider.id).then(loadStatus);
            }}
            onClose={() => setFormProvider(null)}
          />
        )}
      </AnimatePresence>
      <div className="grid gap-3 md:grid-cols-3">
        {OAUTH_PROVIDERS.map((p) => (
          <OAuthCard
            key={p.id}
            p={p}
            status={statuses.find((s) => s.id === p.id)}
            state={states[p.id]?.state ?? "idle"}
            message={states[p.id]?.message}
            onConnect={() => connect(p.id)}
            onSync={() => runSync(p.id).then(loadStatus)}
            onDisconnect={() => disconnect(p.id)}
            lastSync={syncedByProvider[p.id]?.lastSync}
            dayCount={syncedByProvider[p.id]?.dayCount}
          />
        ))}
      </div>

      <SectionHeading title="Export-based sources" subtitle="A web app can't sync these directly — export and upload" />
      <div className="grid gap-3 md:grid-cols-3">
        {EXPORT_PROVIDERS.map((p) => (
          <Card key={p.id} className="flex h-full flex-col p-5">
            <div className="flex items-start gap-3">
              <ProviderLogo p={p} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-base-400">{p.provides}</p>
              </div>
            </div>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-base-400">{p.note}</p>
            <Link href="/upload" className="mt-4 inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-xs font-medium text-base-200 transition hover:bg-white/[0.08]">
              <Upload size={12} /> Upload {p.name}
            </Link>
          </Card>
        ))}
      </div>

      <FadeIn>
        <Card className="mt-8 flex items-start gap-4 border-status-good/15 bg-status-good/[0.04]">
          <Lock size={18} className="mt-0.5 shrink-0 text-[#6ee7b7]" />
          <p className="text-sm leading-relaxed text-base-300">
            <span className="font-medium text-white">Where your keys live:</span> tokens and keys are stored in a secure,
            httpOnly cookie your browser never exposes to scripts — not in env vars, not in a database. Each sync fetches
            your data through a serverless function that returns it without storing it; the result is saved only in this
            browser, and you can disconnect (which forgets the key) any time.
          </p>
        </Card>
      </FadeIn>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectionsBody />
    </Suspense>
  );
}
