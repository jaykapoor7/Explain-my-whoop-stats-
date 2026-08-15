import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BatteryCharging, HeartPulse, LineChart, Lock, Moon } from "lucide-react";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  // Absolute so the tab reads exactly "CURA — …" (matches the OAuth consent
  // screen app name) rather than the layout's "… · CURA" template.
  title: { absolute: "CURA — your body, clearly" },
  description:
    "CURA turns your wearable data into clear daily Recovery, Sleep, Strain and Energy scores, each explained in plain English, with personal patterns and trends.",
};

const PILLARS = [
  { icon: HeartPulse, color: "#13b57e", name: "Recovery", body: "How ready your body is for the day, from overnight HRV and resting heart rate versus your own baseline." },
  { icon: Moon, color: "#7b68ee", name: "Sleep", body: "A nightly score from your time asleep versus your personal need, plus deep/REM sleep and efficiency." },
  { icon: Activity, color: "#ef5a45", name: "Strain", body: "How much cardiovascular load you took on, scored against your personal heart-rate reserve." },
  { icon: BatteryCharging, color: "#eb9d18", name: "Energy", body: "How much capacity you woke with and how much you have left, from recovery, sleep and yesterday's load." },
];

const card = "rounded-2xl border border-black/[0.06] bg-ink-900 p-5 shadow-card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-50">
      {/* Top bar */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <span className="font-display text-lg font-bold tracking-[0.14em] text-ink-50">CURA</span>
        </div>
        <Link href="/today" className="rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-[#241f18]">Open the app</Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pb-8 pt-10 text-center sm:pt-16">
        <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink-50 sm:text-[3.25rem]">
          Your body, clearly.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-300">
          {APP_NAME} is a personal health dashboard that turns the data from your wearable into clear daily
          <span className="font-medium text-ink-50"> Recovery, Sleep, Strain and Energy</span> scores — each explained in
          plain English, measured against your own baseline, so you can see how ready you are and why.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/today" className="rounded-full bg-recovery px-6 py-3 text-sm font-semibold text-[#241f18] shadow-lift">Open CURA</Link>
          <Link href="/privacy" className="rounded-full border border-black/[0.12] px-6 py-3 text-sm font-medium text-ink-200 hover:bg-black/[0.04]">How your data is used</Link>
        </div>
        <p className="mt-4 text-xs text-ink-400">Connects to Google Health / Fitbit · not a medical device</p>
      </section>

      {/* What it does */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-center font-display text-2xl font-bold text-ink-50">What {APP_NAME} shows you</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.name} className={card}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${p.color}1f`, color: p.color }}>
                <p.icon size={20} />
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink-50">{p.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-center font-display text-2xl font-bold text-ink-50">How it works</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {[
            { n: "1", t: "Connect your wearable", b: "Sign in with Google to securely connect your Google Health / Fitbit data — sleep, heart rate, HRV and activity." },
            { n: "2", t: "Get personalised scores", b: "CURA computes your Recovery, Sleep, Strain and Energy each day, measured against your own personal baseline." },
            { n: "3", t: "Understand the why", b: "Every score breaks down into the factors behind it, with trends and patterns unique to you — synced across your devices." },
          ].map((s) => (
            <div key={s.n} className={card}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-recovery/20 font-display text-sm font-bold text-recovery">{s.n}</span>
              <h3 className="mt-3 text-base font-semibold text-ink-50">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{s.b}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-ink-400">
          <LineChart size={16} className="text-ink-400" />
          <span>Also includes journaling, nutrition, medication tracking and a planner — all in one place.</span>
        </div>
      </section>

      {/* Data & privacy */}
      <section className="mx-auto max-w-3xl px-5 py-10">
        <div className={card}>
          <div className="flex items-center gap-2.5">
            <Lock size={18} className="text-good" />
            <h2 className="font-display text-xl font-bold text-ink-50">Your data, your account</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            {APP_NAME} reads your Google Health / Fitbit health and fitness data (such as heart rate, HRV, sleep and
            activity) for one purpose: to calculate and show <span className="font-medium text-ink-100">your own</span>{" "}
            health scores and trends back to you. Your data is stored in your personal account so it stays in sync across
            your devices, is never sold, and is never used for advertising. Medication and journal entries are treated as
            sensitive and are never used to train models.
          </p>
          <p className="mt-3 text-sm text-ink-400">
            Read our <Link href="/privacy" className="text-recovery underline">Privacy Policy</Link> and{" "}
            <Link href="/terms" className="text-recovery underline">Terms of Service</Link>.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl border-t border-black/[0.06] px-5 py-10 text-center text-xs text-ink-400">
        <div className="flex items-center justify-center gap-2">
          <Logo size={22} />
          <span className="font-display font-bold tracking-[0.14em] text-ink-200">CURA</span>
        </div>
        <p className="mt-3">
          <Link href="/privacy" className="hover:text-ink-200">Privacy</Link> ·{" "}
          <Link href="/terms" className="hover:text-ink-200">Terms</Link> ·{" "}
          <Link href="/today" className="hover:text-ink-200">Open the app</Link>
        </p>
        <p className="mt-3 text-ink-500">{APP_NAME} is a personal wellness tool and is not a medical device.</p>
      </footer>
    </div>
  );
}
