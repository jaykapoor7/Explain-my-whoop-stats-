import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Moon, Activity, BatteryCharging, HeartPulse, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  // Absolute so the tab reads exactly "CURA — …" (matches the OAuth consent
  // screen app name) rather than the layout's "… · CURA" template.
  title: { absolute: "CURA — your body, clearly" },
  description:
    "CURA turns your wearable data into clear daily Recovery, Sleep, Strain and Energy scores, each explained in plain English, with personal patterns and trends.",
};

/** Static score ring for the marketing preview (no animation — server-rendered). */
function Ring({ score, color, size = 128 }: { score: number; color: string; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(59,46,20,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-display text-[2.1rem] font-bold leading-none text-ink-50">{score}</span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-recovery">Recovery</span>
      </div>
    </div>
  );
}

const LEDGER = [
  { label: "HRV", detail: "+1.3σ vs your normal", pts: "+13", good: true, w: "82%" },
  { label: "Sleep debt", detail: "3h 40m shortfall", pts: "−11", good: false, w: "68%" },
  { label: "Resting HR", detail: "−0.3σ", pts: "−2", good: false, w: "22%" },
  { label: "Training load", detail: "easy yesterday", pts: "+2", good: true, w: "18%" },
];

const MINI = [
  { name: "Energy", score: 65, color: "#eb9d18" },
  { name: "Sleep", score: 88, color: "#7b68ee" },
  { name: "Strain", score: 11.4, color: "#ef5a45", scale: "/21" },
];

const PILLARS = [
  { icon: HeartPulse, color: "#13b57e", name: "Recovery", body: "How ready you are today, from overnight HRV and resting heart rate vs your own baseline." },
  { icon: Moon, color: "#7b68ee", name: "Sleep", body: "A nightly score from time asleep vs your personal need, plus deep/REM and efficiency." },
  { icon: Activity, color: "#ef5a45", name: "Strain", body: "Cardiovascular load scored against your own heart-rate reserve — not a generic scale." },
  { icon: BatteryCharging, color: "#eb9d18", name: "Energy", body: "The capacity you woke with and how much is left, from recovery, sleep and yesterday's load." },
];

const cardCls = "rounded-[1.4rem] border border-black/[0.07] bg-gradient-to-b from-[#fefcf8] to-[#fbf7ef] shadow-[0_1px_0_0_rgba(255,255,255,0.7)_inset,0_24px_60px_-34px_rgba(59,46,20,0.4)]";

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="font-display text-lg font-bold tracking-[0.16em] text-ink-50">CURA</span>
        </div>
        <Link href="/today" className="rounded-full bg-ink-50 px-4 py-2 text-xs font-semibold text-ink-950 transition hover:opacity-90">Open the app</Link>
      </header>

      {/* Hero — asymmetric: story on the left, the real product on the right. */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-10 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-black/[0.02] px-3 py-1 text-[11px] font-medium text-ink-400">
            <span className="h-1.5 w-1.5 rounded-full bg-recovery" /> Recovery · Sleep · Strain · Energy
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] text-ink-50 sm:text-[3.4rem]">
            Understand your body,<br className="hidden sm:block" /> not just your numbers.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-300">
            Your Fitbit gives you charts. {APP_NAME} gives you an answer. Four daily scores, each measured against
            <span className="text-ink-100"> your own</span> baseline and broken down into the exact reasons behind it —
            so you know how ready you are, and why.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/today" className="group inline-flex items-center gap-2 rounded-full bg-recovery px-6 py-3 text-sm font-semibold text-[#241f18] shadow-lift transition hover:brightness-[1.03]">
              Open CURA <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/privacy" className="rounded-full px-4 py-3 text-sm font-medium text-ink-300 underline-offset-4 hover:text-ink-50 hover:underline">
              How your data is used
            </Link>
          </div>
          <p className="mt-5 text-xs text-ink-400">Works with Google Health &amp; Fitbit · your data stays yours · not a medical device</p>
        </div>

        {/* Product preview — the actual UI, not a description of it. */}
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-recovery/10 blur-3xl" />
          <div className={`${cardCls} p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">Today</div>
                <div className="mt-0.5 font-display text-lg font-bold text-ink-50">Sunday morning</div>
              </div>
              <span className="rounded-full bg-recovery/15 px-2.5 py-1 text-[11px] font-semibold text-recovery">Adequate</span>
            </div>

            <div className="mt-4 flex items-center gap-5">
              <Ring score={72} color="#13b57e" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-relaxed text-ink-300">
                  Partial recovery — you can train, but keep it moderate. Biggest drag: <span className="font-medium text-ink-100">sleep debt</span>.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {MINI.map((m) => (
                    <div key={m.name} className="rounded-xl border border-black/[0.06] bg-black/[0.015] px-2 py-2 text-center">
                      <div className="tabular font-display text-lg font-bold" style={{ color: m.color }}>{m.score}{m.scale ? <span className="text-[10px] text-ink-400">{m.scale}</span> : null}</div>
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">{m.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">What drove it today</div>
              <div className="space-y-1.5">
                {LEDGER.map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className={`w-4 text-center text-sm ${r.good ? "text-good" : "text-bad"}`}>{r.good ? "↑" : "↓"}</span>
                    <span className="text-[13px] text-ink-100">{r.label}</span>
                    <span className="hidden text-[11px] text-ink-400 sm:inline">{r.detail}</span>
                    <div className="ml-auto hidden h-1.5 w-20 overflow-hidden rounded-full bg-black/[0.06] sm:block">
                      <div className={`h-full rounded-full ${r.good ? "bg-good" : "bg-bad"}`} style={{ width: r.w, opacity: 0.85 }} />
                    </div>
                    <span className={`tabular w-9 text-right text-[13px] font-semibold ${r.good ? "text-good" : "text-bad"}`}>{r.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The differentiator, stated plainly and shown, not gridded. */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-ink-50">
            Most apps hand you a number. CURA tells you where it came from.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-300">
            Every score is a running total you can read line by line — what helped, what hurt, and by how much, always
            against <span className="text-ink-100">your own</span> normal range rather than a population average. Over
            weeks it learns your patterns: how late caffeine costs you sleep, how a hard week bleeds into recovery.
          </p>
        </div>

        {/* Pillars — a tight row, colour-led, not four identical floating cards. */}
        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.name} className="flex gap-4 border-l-2 pl-4" style={{ borderColor: p.color }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p.icon size={16} style={{ color: p.color }} />
                  <h3 className="text-[15px] font-semibold text-ink-50">{p.name}</h3>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-400">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — three steps, left-aligned, minimal chrome. */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { n: "01", t: "Connect your wearable", b: "Sign in with Google to link your Google Health / Fitbit data — sleep, heart rate, HRV and activity." },
            { n: "02", t: "Get scores that fit you", b: "CURA computes Recovery, Sleep, Strain and Energy each day against your own baseline, not a generic one." },
            { n: "03", t: "See the why, and the patterns", b: "Every score breaks down into its factors, with trends and personal patterns — synced across your devices." },
          ].map((s) => (
            <div key={s.n}>
              <div className="font-display text-sm font-bold tracking-[0.2em] text-recovery">{s.n}</div>
              <h3 className="mt-3 text-[15px] font-semibold text-ink-50">{s.t}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-400">{s.b}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[13.5px] text-ink-400">
          Plus journaling, nutrition, medication tracking and a body-aware planner — one place instead of five apps.
        </p>
      </section>

      {/* Data & privacy */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className={`${cardCls} p-7`}>
          <div className="flex items-center gap-2.5">
            <Lock size={17} className="text-good" />
            <h2 className="font-display text-lg font-bold text-ink-50">Your data, your account</h2>
          </div>
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-400">
            {APP_NAME} reads your Google Health / Fitbit data (heart rate, HRV, sleep and activity) for one purpose: to
            calculate and show <span className="font-medium text-ink-100">your own</span> scores and trends back to you.
            It&apos;s stored in your personal account so it syncs across your devices, is never sold, and is never used for
            advertising. Medication and journal entries are treated as sensitive and are never used to train models.
          </p>
          <p className="mt-3 text-[14px] text-ink-400">
            Read our <Link href="/privacy" className="text-recovery underline underline-offset-2">Privacy Policy</Link> and{" "}
            <Link href="/terms" className="text-recovery underline underline-offset-2">Terms of Service</Link>.
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-black/[0.06] px-6 py-10 text-xs text-ink-400">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="font-display font-bold tracking-[0.16em] text-ink-200">CURA</span>
          </div>
          <p className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-ink-200">Privacy</Link>
            <Link href="/terms" className="hover:text-ink-200">Terms</Link>
            <Link href="/today" className="hover:text-ink-200">Open the app</Link>
          </p>
        </div>
        <p className="mt-4 text-ink-500">{APP_NAME} is a personal wellness tool, not a medical device.</p>
      </footer>
    </div>
  );
}
