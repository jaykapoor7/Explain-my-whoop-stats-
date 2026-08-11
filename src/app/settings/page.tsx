"use client";

import { Plug, RotateCcw, ShieldCheck } from "lucide-react";
import { Card, PageHeader, Section, SkeletonPage } from "@/components/ui";
import { useOverlay } from "@/lib/data/store";
import { cn } from "@/lib/format";

export default function SettingsPage() {
  const { settings, setSettings, resetAll, hydrated } = useOverlay();
  if (!hydrated) return <SkeletonPage />;

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Settings" sub="Preferences, data sources, and your data." />

      <Section title="Profile">
        <Card className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-300">Display name</span>
            <input
              value={settings.name}
              onChange={(e) => setSettings({ name: e.target.value })}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-white/25 sm:max-w-xs"
            />
          </label>
          <div>
            <span className="text-xs font-medium text-ink-300">Weight unit</span>
            <div className="mt-1.5 flex overflow-hidden rounded-lg border border-white/[0.08] text-xs" style={{ width: "fit-content" }}>
              {(["kg", "lb"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setSettings({ weightUnit: u })}
                  className={cn("px-4 py-2 font-medium", settings.weightUnit === u ? "bg-white/[0.1] text-ink-50" : "text-ink-400")}
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

      <Section title="Data source">
        <Card className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-ink-200">
            <Plug size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-100">Sample data (deterministic mock)</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              You&apos;re viewing 90 days of realistic generated data. The app is built on a{" "}
              <code className="rounded bg-white/[0.07] px-1 py-0.5 text-[10px]">HealthDataProvider</code> interface — a{" "}
              <code className="rounded bg-white/[0.07] px-1 py-0.5 text-[10px]">GoogleHealthProvider</code> for your
              Fitbit Air plugs in here without touching any screen or score code. Apple Health, Garmin, WHOOP and Oura
              can follow the same interface.
            </p>
          </div>
        </Card>
      </Section>

      <Section title="Privacy">
        <Card className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-good/10 text-good">
            <ShieldCheck size={16} />
          </span>
          <p className="text-xs leading-relaxed text-ink-400">
            All of your edits — journal, medication logs, meals, tasks — live in this browser&apos;s local storage and
            never leave your device in this build. Medication and journal data are treated as sensitive: excluded from
            any future analytics by default, and never used to train models. No secrets or personal data are committed
            to the repository; credentials will use environment variables.
          </p>
        </Card>
      </Section>

      <Section title="Your data">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink-100">Reset local data</p>
            <p className="mt-0.5 text-xs text-ink-400">Clears your logs and edits on this device. The sample dataset regenerates.</p>
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
        Health OS · open source · not a medical device. Scores are placeholders until the final models are designed.
      </p>
    </div>
  );
}
