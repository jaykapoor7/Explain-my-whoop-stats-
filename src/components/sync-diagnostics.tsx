"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Copy, Info, Loader2, MinusCircle, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui";
import { useApp, collectSyncState } from "@/lib/data/store";
import { useAccount } from "@/components/account";
import { fmtDate, fmtDuration, fmtNum } from "@/lib/format";
import { DailySummary } from "@/lib/types";

/** Definitive cloud-sync check: writes this device's data to the account
 * (Supabase) and reads it straight back, proving whether your planner / to-dos /
 * profile actually persist to the backend and would appear on another device —
 * and surfacing the real error if they don't. */
function CloudSyncTest() {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean; durable: boolean; wrote: boolean; readBack: boolean;
    tasks: number; todos: number; journal: number; birthYear: boolean; error?: string;
  }>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const state = useApp.getState();
      const data = collectSyncState(state);
      const updatedAt = Date.now();
      // 1) write
      const w = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, updatedAt }) });
      if (w.status === 401) { setResult({ ok: false, durable: false, wrote: false, readBack: false, tasks: 0, todos: 0, journal: 0, birthYear: false, error: "Not signed in — sign in with Google first (sync is per account)." }); return; }
      const wj = await w.json().catch(() => ({}));
      if (!w.ok) { setResult({ ok: false, durable: wj.durable !== false, wrote: false, readBack: false, tasks: 0, todos: 0, journal: 0, birthYear: false, error: `Write failed (HTTP ${w.status}) — ${wj.error ?? "database not reachable"}.` }); return; }
      // 2) read back
      const r = await fetch("/api/data", { cache: "no-store" });
      const rj = await r.json().catch(() => ({}));
      const durable = rj.durable !== false;
      const cloud = rj.data ? JSON.parse(rj.data) as Record<string, unknown> : null;
      const tasksArr = (cloud?.tasks as unknown[]) ?? [];
      const settings = (cloud?.settings as { birthYear?: number }) ?? {};
      const readBack = !!cloud && rj.updatedAt === updatedAt;
      setResult({
        ok: durable && readBack,
        durable,
        wrote: true,
        readBack,
        tasks: tasksArr.filter((t) => !(t as { todo?: boolean }).todo).length,
        todos: tasksArr.filter((t) => (t as { todo?: boolean }).todo).length,
        journal: Object.keys((cloud?.journal as object) ?? {}).length,
        birthYear: typeof settings.birthYear === "number",
        error: !durable ? "No database is connected in this deployment — data stays on this device. Set DATABASE_URL / POSTGRES_URL (Supabase) in your host." : !readBack ? "Wrote, but the read-back didn't match — the write may not be committing." : undefined,
      });
    } catch (e) {
      setResult({ ok: false, durable: false, wrote: false, readBack: false, tasks: 0, todos: 0, journal: 0, birthYear: false, error: e instanceof Error ? e.message : "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-recovery/12 text-recovery">
          {account.syncDurable ? <Cloud size={14} /> : <CloudOff size={14} />}
        </span>
        <span className="text-sm font-semibold text-ink-100">Cloud sync</span>
        <button onClick={run} disabled={busy} className="ml-auto flex items-center gap-1.5 rounded-full bg-recovery px-3.5 py-1.5 text-xs font-semibold text-[#241f18] disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />} Test sync
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        Writes this device&apos;s data to your account and reads it back — proves your planner, to-dos and profile persist
        to the backend (and would show on another device signed into the same account).
      </p>
      {result && (
        <div className="mt-3 space-y-1.5">
          <Row ok={account.signedIn} label={account.signedIn ? "Signed in" : "Not signed in — sync is per account"} />
          <Row ok={result.durable} label={result.durable ? "Database connected (persists across devices)" : "No database — this device only"} />
          <Row ok={result.wrote} label="Wrote your data to the account" />
          <Row ok={result.readBack} label="Read the same data straight back" />
          {result.ok && (
            <p className="mt-2 rounded-lg bg-good/10 px-3 py-2 text-[11px] leading-relaxed text-good">
              Syncing ✓ — {result.tasks} planned item{result.tasks === 1 ? "" : "s"}, {result.todos} to-do{result.todos === 1 ? "" : "s"}, {result.journal} journal entr{result.journal === 1 ? "y" : "ies"} and your birth year {result.birthYear ? "are" : "would be"} saved to your account. Sign into the same account on another device to see them.
            </p>
          )}
          {result.error && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-bad/10 px-3 py-2 text-[11px] leading-relaxed text-bad">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {result.error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? <CheckCircle2 size={13} className="shrink-0 text-good" /> : <AlertTriangle size={13} className="shrink-0 text-bad" />}
      <span className="text-ink-200">{label}</span>
    </div>
  );
}

interface RawProbe {
  type: string;
  status: number;
  ok: boolean;
  count: number;
  sampleKeys: string[];
  sample?: unknown;
  note?: string;
}

/** Live connection test: hits each Google Health type and shows the real
 *  status + field names, so a connection/scope problem is distinguishable
 *  from a field-mapping gap. Copy the result to share it for a precise fix. */
function ConnectionTest() {
  const connected = useApp((s) => s.wearableDays.length > 0);
  const [busy, setBusy] = useState(false);
  const [probes, setProbes] = useState<RawProbe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setProbes(null);
    try {
      const r = await fetch("/api/fitbit/raw", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        setError(
          j.error === "not_connected"
            ? "Not connected — connect your Fitbit above first."
            : j.error === "refresh_failed"
              ? "Your session expired — disconnect and reconnect above."
              : j.message || j.error || "Test failed."
        );
      } else {
        setProbes(j.probes as RawProbe[]);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(JSON.stringify(probes, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-recovery/12 text-recovery">
          <Stethoscope size={14} />
        </span>
        <span className="text-sm font-semibold text-ink-100">Connection test</span>
        <button
          onClick={run}
          disabled={busy}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-recovery px-3.5 py-1.5 text-xs font-semibold text-[#241f18] disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Stethoscope size={13} />} Run test
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        Asks Google Health directly for each metric and shows the real response — this tells us whether a metric is a
        connection/permission problem or a data-format mismatch we can fix.
      </p>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-bad">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {probes && (
        <div className="mt-3">
          <div className="overflow-hidden rounded-xl border border-black/[0.06]">
            {probes.map((p) => {
              const good = p.ok && p.count > 0;
              const auth = p.status === 401 || p.status === 403;
              return (
                <div key={p.type} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/[0.05] px-3 py-2 last:border-0">
                  <span className="shrink-0">
                    {good ? (
                      <CheckCircle2 size={13} className="text-good" />
                    ) : (
                      <AlertTriangle size={13} className={auth ? "text-bad" : "text-warn"} />
                    )}
                  </span>
                  <span className="w-52 shrink-0 font-mono text-[11px] text-ink-100">{p.type}</span>
                  <span className="tabular text-[11px] text-ink-400">HTTP {p.status || "—"}</span>
                  <span className="tabular text-[11px] text-ink-400">{p.count} pts</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-ink-500" title={p.sampleKeys.join(", ") || p.note}>
                    {p.count > 0 ? p.sampleKeys.slice(0, 8).join(", ") : p.note ? `⚠ ${p.note}` : "no data returned"}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={copy}
            className="mt-3 flex items-center gap-1.5 rounded-full border border-black/12 px-3.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-black/[0.06]"
          >
            <Copy size={12} /> {copied ? "Copied — paste it to me" : "Copy full result"}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
            Copy this and paste it back in chat — it contains the exact field names for your account, which is what&apos;s
            needed to map sleep, strain and the rest correctly. It&apos;s your own data and never leaves your device
            except when you paste it.
          </p>
        </div>
      )}
      {!probes && !connected && (
        <p className="mt-2 text-[11px] text-ink-500">Connect and sync above first, then run this to see what&apos;s coming through.</p>
      )}
    </Card>
  );
}

/**
 * Sync diagnostics — the honesty panel. It reads back exactly what the last
 * Google Health sync mapped onto each day so the numbers can be checked
 * against the Fitbit app, and flags any raw metric that came back empty
 * across every day (the tell-tale sign that a field didn't map, rather than
 * that you have no such data).
 */

interface Metric {
  key: string;
  label: string;
  unit: string;
  /** true = pulled straight from Fitbit; false = derived/approximated by the app */
  raw: boolean;
  get: (d: DailySummary) => number | undefined;
  fmt?: (v: number) => string;
}

const METRICS: Metric[] = [
  { key: "hrv", label: "HRV", unit: "ms", raw: true, get: (d) => d.hrv?.rmssdMs },
  { key: "rhr", label: "Resting HR", unit: "bpm", raw: true, get: (d) => d.rhr?.bpm },
  { key: "steps", label: "Steps", unit: "", raw: true, get: (d) => d.steps, fmt: (v) => fmtNum(v) },
  { key: "sleep", label: "Sleep", unit: "", raw: true, get: (d) => d.sleep?.asleepMin, fmt: (v) => fmtDuration(v) },
  { key: "cal", label: "Calories burned", unit: "kcal", raw: true, get: (d) => (d.activeCalories || 0) + (d.restingCalories || 0), fmt: (v) => fmtNum(v) },
  { key: "weight", label: "Weight", unit: "kg", raw: true, get: (d) => d.weightKg },
  { key: "acts", label: "Workouts", unit: "", raw: true, get: (d) => d.activities.length },
];

const present = (v: number | undefined) => v !== undefined && v > 0;

function CoverageRow({ metric, days }: { metric: Metric; days: DailySummary[] }) {
  const count = days.filter((d) => present(metric.get(d))).length;
  const total = days.length;
  const none = count === 0;
  const partial = count > 0 && count < total;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="shrink-0">
        {none ? (
          <AlertTriangle size={14} className="text-warn" />
        ) : partial ? (
          <MinusCircle size={14} className="text-ink-400" />
        ) : (
          <CheckCircle2 size={14} className="text-good" />
        )}
      </span>
      <span className="text-[13px] text-ink-100">{metric.label}</span>
      <span className="tabular ml-auto text-xs text-ink-400">
        {count} / {total} days
      </span>
      <span className="w-24 text-right text-[11px] text-ink-500">
        {none ? "no values ⚠" : partial ? "partial" : "full"}
      </span>
    </div>
  );
}

export function SyncDiagnostics() {
  const wearableDays = useApp((s) => s.wearableDays);
  const lastSync = useApp((s) => s.lastSync);

  if (!wearableDays.length) {
    return (
      <div className="space-y-4">
        <CloudSyncTest />
        <ConnectionTest />
        <Card className="flex items-start gap-3 p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-ink-400" />
          <p className="text-xs leading-relaxed text-ink-400">
            Nothing synced yet. Connect above and press <span className="font-medium text-ink-200">Sync now</span> — this
            panel will then show exactly which metrics came back from Fitbit and their values, so you can check them
            against the Fitbit app.
          </p>
        </Card>
      </div>
    );
  }

  const recent = wearableDays.slice(-7).reverse();
  const emptyRaw = METRICS.filter((m) => m.raw && wearableDays.every((d) => !present(m.get(d))));

  return (
    <div className="space-y-4">
      <CloudSyncTest />
      <ConnectionTest />
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-ink-100">Metric coverage</span>
          <span className="text-[11px] text-ink-500">
            {wearableDays.length} days synced{lastSync ? ` · last ${new Date(lastSync).toLocaleString()}` : ""}
          </span>
        </div>
        <div className="mt-2 divide-y divide-black/[0.05]">
          {METRICS.map((m) => (
            <CoverageRow key={m.key} metric={m} days={wearableDays} />
          ))}
        </div>
        {emptyRaw.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/[0.06] p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-xs leading-relaxed text-ink-200">
              <span className="font-semibold">{emptyRaw.map((m) => m.label).join(", ")}</span> came back empty for every
              day. If your Fitbit actually records {emptyRaw.length > 1 ? "these" : "this"}, it&apos;s a field-mapping
              gap in the sync, not missing data — worth reporting so it can be fixed for your account&apos;s exact
              response shape.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <span className="text-sm font-semibold text-ink-100">Last 7 synced days</span>
        <p className="mt-0.5 text-[11px] text-ink-500">Compare these against your Fitbit app to confirm the sync is reading correctly.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500">
                <th className="py-1.5 pr-3 font-medium">Date</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="py-1.5 pr-3 font-medium">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {recent.map((d) => (
                <tr key={d.date} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3 text-ink-300">{fmtDate(d.date, { month: "short", day: "numeric" })}</td>
                  {METRICS.map((m) => {
                    const v = m.get(d);
                    return (
                      <td key={m.key} className="py-1.5 pr-3 text-ink-100">
                        {present(v) ? (m.fmt ? m.fmt(v!) : `${v}${m.unit ? ` ${m.unit}` : ""}`) : <span className="text-ink-500">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="flex items-start gap-3 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-ink-400" />
        <div className="text-xs leading-relaxed text-ink-400">
          <p className="font-medium text-ink-200">How to read your numbers</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              <span className="text-ink-200">Raw from Fitbit</span> — HRV, resting HR, steps, sleep duration &amp;
              stages, total calories, weight and workouts. These should match the Fitbit app.
            </li>
            <li>
              <span className="text-ink-200">Derived approximations</span> — the resting/active calorie split, sleeping
              HR, overnight-HRV attribution, sleep need (8h), sleep debt and consistency are estimated by the app, not
              read from Fitbit. Treat them as rough.
            </li>
            <li>
              <span className="text-ink-200">Scores</span> — Energy, Recovery, Sleep and Strain are computed from your
              real data. The trend and the &ldquo;what affected you&rdquo; ledger tell you more than any single number.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
