"use client";

import { RotateCcw, ShieldCheck } from "lucide-react";
import { FitbitCard } from "@/components/connect";
import { SyncDiagnostics } from "@/components/sync-diagnostics";
import { Card, PageHeader, Section, SkeletonPage } from "@/components/ui";
import { useApp } from "@/lib/data/store";
import { cn } from "@/lib/format";

export default function SettingsPage() {
  const { settings, setSettings, resetAll, hydrated } = useApp();
  if (!hydrated) return <SkeletonPage />;

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Settings" sub="Preferences, data sources, and your data." />

      <Section title="Profile">
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-ink-300">Display name</span>
              <input
                value={settings.name}
                onChange={(e) => setSettings({ name: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-black/25"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-300">Birth year <span className="text-ink-500">· for Health Age</span></span>
              <input
                type="number"
                value={settings.birthYear ?? ""}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setSettings({ birthYear: Number.isFinite(y) ? y : undefined });
                }}
                placeholder="e.g. 1998"
                className="tabular mt-1.5 h-10 w-full rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-black/25"
              />
            </label>
          </div>
          <div>
            <span className="text-xs font-medium text-ink-300">Weight unit</span>
            <div className="mt-1.5 flex overflow-hidden rounded-lg border border-black/[0.08] text-xs" style={{ width: "fit-content" }}>
              {(["kg", "lb"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setSettings({ weightUnit: u })}
                  className={cn("px-4 py-2 font-medium", settings.weightUnit === u ? "bg-black/[0.1] text-ink-50" : "text-ink-400")}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-300">Show unrecognized HR blocks on Strain</span>
            <button
              onClick={() => setSettings({ showLowConfidence: !settings.showLowConfidence })}
              className={cn("h-6 w-11 rounded-full p-0.5 transition-colors", settings.showLowConfidence ? "bg-good" : "bg-ink-600")}
              aria-label="Toggle low-confidence visibility"
            >
              <span className={cn("block h-5 w-5 rounded-full bg-white transition-transform", settings.showLowConfidence && "translate-x-5")} />
            </button>
          </label>
        </Card>
      </Section>

      <Section title="Data source" sub="Sign in with Google to connect your Fitbit / Google Health data; it then syncs to every device you sign in on">
        <FitbitCard autoSyncOnConnected advanced />
      </Section>

      <Section title="Sync diagnostics" sub="Check what the last sync actually pulled from Fitbit, and which numbers are real vs estimated">
        <SyncDiagnostics />
      </Section>

      <Section title="Privacy">
        <Card className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-good/10 text-good">
            <ShieldCheck size={16} />
          </span>
          <p className="text-xs leading-relaxed text-ink-400">
            When you&apos;re signed in, your data is stored in your own account&apos;s database so it syncs across your
            devices; signed out, it stays only in this browser. Medication and journal data are treated as sensitive:
            excluded from any future analytics by default, and never used to train models. Google tokens are encrypted
            at rest and no secrets are committed to the repository — credentials use environment variables.
          </p>
        </Card>
      </Section>

      <Section title="Your data">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink-100">Reset local data</p>
            <p className="mt-0.5 text-xs text-ink-400">Clears synced wearable data, logs and preferences from this device.</p>
          </div>
          <button
            onClick={() => {
              if (confirm("Clear all local logs, edits and preferences?")) resetAll();
            }}
            className="flex items-center gap-1.5 rounded-full border border-bad/30 bg-bad/10 px-4 py-2 text-xs font-semibold text-[#ff9b9b] hover:bg-bad/20"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </Card>
      </Section>

      <p className="mt-8 text-center text-[11px] text-ink-500">
        CURA · not a medical device.
      </p>
    </div>
  );
}
