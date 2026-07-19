"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Link2,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  Sparkles,
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
import { generateDemoData } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type SyncState = "idle" | "connecting" | "syncing" | "done" | "error";

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ProviderLogo({ p }: { p: ProviderInfo }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg"
      style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}99)` }}
    >
      {p.name.slice(0, 2)}
    </span>
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
  const configured = status?.configured;
  const busy = state === "connecting" || state === "syncing";

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
      <Card className="relative flex h-full flex-col overflow-hidden p-5">
        <span
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-3xl"
          style={{ background: p.color }}
        />
        <div className="flex items-start gap-3">
          <ProviderLogo p={p} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{p.name}</h3>
              {connected ? (
                <Badge tone="good">
                  <CheckCircle2 size={11} /> Connected
                </Badge>
              ) : configured === false ? (
                <Badge tone="warning">Needs setup</Badge>
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
              {lastSync && (
                <>
                  {" "}
                  Last sync <span className="text-base-200">{timeAgo(lastSync)}</span>
                  {dayCount ? ` · ${dayCount} days` : ""}.
                </>
              )}
            </span>
          ) : (
            <span>{p.note}</span>
          )}
        </div>

        <AnimatePresence>
          {busy && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center gap-2 text-xs text-accent-soft"
            >
              <Loader2 size={13} className="animate-spin" />
              {state === "connecting" ? "Redirecting to authorize…" : "Syncing your data…"}
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
              <Link2 size={13} /> {configured === false ? "Set up & connect" : `Connect ${p.name}`}
            </Button>
          )}
          {p.scopes && !connected && (
            <span className="ml-auto hidden text-[10px] text-base-400 sm:block">scopes: {p.scopes}</span>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function SetupNotice({ provider, onClose }: { provider: ProviderInfo; onClose: () => void }) {
  const envPrefix = provider.id.toUpperCase();
  return (
    <FadeIn>
      <Card className="gradient-ring relative mb-4 p-5">
        <button onClick={onClose} className="absolute right-4 top-4 text-base-400 hover:text-white">
          <X size={16} />
        </button>
        <h3 className="flex items-center gap-2 font-semibold">
          <Plug size={16} className="text-accent-soft" /> Finish setting up {provider.name}
        </h3>
        <p className="mt-2 text-sm text-base-300">
          {provider.name} live-sync needs a free developer app so the connection can run on your own deployment. One-time setup:
        </p>
        <ol className="mt-3 space-y-1.5 text-sm text-base-200">
          <li>
            1. Create an app at{" "}
            <a href={provider.devConsole} target="_blank" rel="noreferrer" className="text-accent-soft hover:underline">
              {provider.devConsole?.replace("https://", "")}
            </a>
            .
          </li>
          <li>
            2. Set its redirect / callback URL to{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
              {typeof window !== "undefined" ? window.location.origin : "https://your-app"}/api/oauth/{provider.id}/callback
            </code>
            .
          </li>
          <li>
            3. In Vercel → Project → Settings → Environment Variables, add{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{envPrefix}_CLIENT_ID</code> and{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{envPrefix}_CLIENT_SECRET</code>, then redeploy.
          </li>
        </ol>
        <p className="mt-3 text-xs text-base-400">
          Prefer to explore first? Use <span className="text-base-200">Try a simulated sync</span> below — no setup needed.
        </p>
      </Card>
    </FadeIn>
  );
}

function ConnectionsBody() {
  const router = useRouter();
  const params = useSearchParams();
  const mergeSynced = useApp((s) => s.mergeSynced);
  const syncedSources = useApp((s) => s.syncedSources);
  const hydrated = useApp((s) => s.hydrated);

  const [statuses, setStatuses] = useState<ConnectionStatus[]>([]);
  const [states, setStates] = useState<Record<string, { state: SyncState; message?: string }>>({});
  const [setupFor, setSetupFor] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<SyncState>("idle");

  const setState = (id: string, state: SyncState, message?: string) =>
    setStates((s) => ({ ...s, [id]: { state, message } }));

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      const json = await res.json();
      setStatuses(json.providers ?? []);
    } catch {
      // API unavailable (e.g. static preview) — treat all as unconfigured.
      setStatuses(OAUTH_PROVIDERS.map((p) => ({ id: p.id, configured: false, connected: false })));
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

  // Handle OAuth callback query params once on mount.
  useEffect(() => {
    loadStatus();
    const connected = params.get("connected");
    const setup = params.get("setup");
    const error = params.get("error");
    if (connected) {
      runSync(connected).then(loadStatus);
    }
    if (setup) setSetupFor(setup);
    if (error) {
      const [prov, reason] = error.split(":");
      setState(prov, "error", reason === "denied" ? "Authorization was cancelled." : "Connection failed.");
    }
    if (connected || setup || error) router.replace("/connections");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = (id: string) => {
    const status = statuses.find((s) => s.id === id);
    if (status && !status.configured) {
      setSetupFor(id);
      return;
    }
    setState(id, "connecting");
    window.location.href = `/api/oauth/${id}/start`;
  };

  const disconnect = async (id: string) => {
    await fetch(`/api/oauth/${id}/disconnect`, { method: "POST" }).catch(() => {});
    setState(id, "idle");
    loadStatus();
  };

  const runDemo = async () => {
    setDemoState("connecting");
    await new Promise((r) => setTimeout(r, 700));
    setDemoState("syncing");
    await new Promise((r) => setTimeout(r, 900));
    const days = generateDemoData();
    mergeSynced(days, "demo", "WHOOP (demo)");
    setDemoState("done");
  };

  const syncedByProvider = useMemo(
    () => Object.fromEntries(syncedSources.map((s) => [s.provider, s])),
    [syncedSources]
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
          <p className="mt-1 max-w-2xl text-sm text-base-400">
            Connect a wearable account and your data syncs automatically — no exporting files. Tokens stay in a secure
            server-side cookie; synced data lands only in this browser.
          </p>
        </div>
        <Link href="/upload" className="text-sm font-medium text-accent-soft hover:underline">
          Upload files instead →
        </Link>
      </div>

      {/* Demo / simulated sync */}
      <FadeIn className="mt-6">
        <Card className="gradient-ring flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-vivid-violet to-vivid-cyan text-white shadow-glow">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="font-semibold">Try a simulated live sync</h3>
              <p className="mt-0.5 text-sm text-base-400">
                See the connect → sync → dashboard flow instantly with six months of realistic demo data. No account needed.
              </p>
            </div>
          </div>
          <Button onClick={runDemo} disabled={demoState === "connecting" || demoState === "syncing"} className="shrink-0">
            {demoState === "connecting" && <><Loader2 size={14} className="animate-spin" /> Connecting…</>}
            {demoState === "syncing" && <><Loader2 size={14} className="animate-spin" /> Syncing…</>}
            {demoState === "done" && <><CheckCircle2 size={14} /> Synced — open dashboard</>}
            {demoState === "idle" && <><Plug size={14} /> Run simulated sync</>}
          </Button>
        </Card>
        {demoState === "done" && (
          <div className="mt-2 text-center text-sm text-base-400">
            Demo data loaded.{" "}
            <Link href="/dashboard" className="text-accent-soft hover:underline">
              Go to your dashboard →
            </Link>
          </div>
        )}
      </FadeIn>

      <SectionHeading title="Auto-sync wearables" subtitle="OAuth connections — connect once, sync every visit" />
      {setupFor && (
        <SetupNotice
          provider={OAUTH_PROVIDERS.find((p) => p.id === setupFor)!}
          onClose={() => setSetupFor(null)}
        />
      )}
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
            <Link
              href="/upload"
              className="mt-4 inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-white/15 px-3.5 text-xs font-medium text-base-200 transition hover:bg-white/[0.08]"
            >
              <Upload size={12} /> Upload {p.name}
            </Link>
          </Card>
        ))}
      </div>

      <FadeIn>
        <Card className="mt-8 flex items-start gap-4 border-status-good/15 bg-status-good/[0.04]">
          <Lock size={18} className="mt-0.5 shrink-0 text-[#6ee7b7]" />
          <p className="text-sm leading-relaxed text-base-300">
            <span className="font-medium text-white">How connected sync stays private:</span> the OAuth token is held in a
            secure, httpOnly cookie your browser never exposes to scripts. On each sync a serverless function fetches your
            data, normalizes it, and returns it — it isn&apos;t stored on any server. The result is saved only in this
            browser, exactly like uploaded files, and your data is never used to train AI models.
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
