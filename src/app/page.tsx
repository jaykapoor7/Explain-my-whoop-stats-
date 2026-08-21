import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock, LineChart, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { ScoresShowcase } from "@/components/card-swipe";
import { APP_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  // Absolute so the tab reads exactly "CURA — …" (matches the OAuth consent
  // screen app name) rather than the layout's "… · CURA" template.
  title: { absolute: "CURA — your body, clearly" },
  description:
    "CURA turns your wearable data into clear daily Recovery, Sleep, Strain and Energy scores, each explained in plain English, with personal patterns and trends.",
};

/** Static score ring for the marketing preview (no animation — server-rendered). */
function Ring({ score, color, label, size = 132 }: { score: number; color: string; label: string; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(59,46,20,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-display text-[2.2rem] font-bold leading-none tracking-[-0.02em] text-ink-50">{score}</span>
        <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

/** Small-caps section eyebrow — consistent rhythm marker above every section head. */
function Eyebrow({ children, color = "#13b57e" }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px w-6" style={{ background: color }} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-400">{children}</span>
    </div>
  );
}

/** Faux app-window chrome so the product shots read as the real, shipped UI. */
function AppWindow({ tab, children }: { tab: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.3rem] border border-black/[0.08] bg-[#fbf7ef] shadow-[0_1px_0_0_rgba(255,255,255,0.7)_inset,0_2px_6px_-2px_rgba(59,46,20,0.12),0_40px_80px_-40px_rgba(59,46,20,0.5)]">
      <div className="flex items-center gap-2 border-b border-black/[0.06] bg-[#f5f0e6] px-4 py-3">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0716a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e6b34d]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#69c08a]" />
        </span>
        <span className="mx-auto flex items-center gap-1.5 rounded-md bg-black/[0.03] px-2.5 py-1 text-[11px] text-ink-400">
          <Lock size={10} /> cura.kapoorjay.com<span className="text-ink-500">/{tab}</span>
        </span>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
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

const READS =["Overnight HRV", "Resting HR", "Sleep stages", "Respiratory rate", "Activity & steps", "Workouts"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-50">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#f4efe4]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-display text-lg font-bold tracking-[0.16em] text-ink-50">CURA</span>
          </div>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-ink-300 md:flex">
            <a href="#how" className="transition-colors hover:text-ink-50">How it works</a>
            <a href="#patterns" className="transition-colors hover:text-ink-50">Patterns</a>
            <Link href="/privacy" className="transition-colors hover:text-ink-50">Privacy</Link>
          </nav>
          <Link href="/today" className="rounded-full bg-ink-50 px-4 py-2 text-[13px] font-semibold text-ink-950 transition hover:opacity-90">Open the app</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* backdrop: soft recovery glow + a faint technical dot-grid that fades out */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10rem] h-[30rem] w-[54rem] -translate-x-1/2 rounded-full bg-recovery/[0.10] blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage: "radial-gradient(rgba(59,46,20,0.07) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              maskImage: "radial-gradient(120% 70% at 50% 0%, #000 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(120% 70% at 50% 0%, #000 30%, transparent 75%)",
            }}
          />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-14 pt-14 lg:grid-cols-[1.04fr_0.96fr] lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#fdfaf3] px-3 py-1 text-[11px] font-medium text-ink-400 shadow-[0_1px_2px_rgba(59,46,20,0.05)]">
              <span className="h-1.5 w-1.5 rounded-full bg-recovery" /> Recovery · Sleep · Strain · Energy
            </span>
            <h1 className="mt-6 font-display text-[2.75rem] font-bold leading-[1.0] tracking-[-0.035em] text-ink-50 sm:text-[3.6rem]">
              Understand your body,<br className="hidden sm:block" /> not just your numbers.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-300">
              Your Fitbit gives you charts. {APP_NAME} gives you an answer. Four daily scores, each measured against
              <span className="text-ink-100"> your own</span> baseline and broken down into the exact reasons behind it —
              so you know how ready you are, and why.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/today" className="group inline-flex items-center gap-2 rounded-full bg-recovery px-6 py-3 text-sm font-semibold text-[#0c3325] shadow-lift transition hover:brightness-[1.04]">
                Open CURA <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#how" className="rounded-full border border-black/[0.1] bg-[#fdfaf3] px-5 py-3 text-sm font-medium text-ink-200 transition hover:border-black/20 hover:text-ink-50">
                See how it works
              </a>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
              <span>Works with Google Health &amp; Fitbit</span>
              <span className="text-ink-600">·</span>
              <span>your data stays yours</span>
              <span className="text-ink-600">·</span>
              <span>not a medical device</span>
            </p>
          </div>

          {/* Product preview — the actual UI, framed like the shipped app. */}
          <AppWindow tab="today">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">Today</div>
                <div className="mt-0.5 font-display text-lg font-bold text-ink-50">Sunday morning</div>
              </div>
              <span className="rounded-full bg-recovery/15 px-2.5 py-1 text-[11px] font-semibold text-recovery">Adequate</span>
            </div>

            <div className="mt-5 flex items-center gap-5">
              <Ring score={72} color="#13b57e" label="Recovery" />
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
          </AppWindow>
        </div>

        {/* Capability strip — honest "what it reads", not fake company logos. */}
        <div className="border-y border-black/[0.06] bg-[#f6f1e7]/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">Reads from your wearable</span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {READS.map((r) => (
                <span key={r} className="text-[13px] font-medium text-ink-300">{r}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The differentiator — copy left, an interactive deck of the four scores right. */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_0.82fr]">
          <div>
            <Eyebrow>Why CURA</Eyebrow>
            <h2 className="mt-4 font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] text-ink-50 sm:text-[2.3rem]">
              Most apps hand you a number. CURA tells you where it came from.
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-300">
              Every score is a running total you can read line by line — what helped, what hurt, and by how much, always
              against <span className="text-ink-100">your own</span> normal range rather than a population average. Over
              weeks it learns your patterns: how late caffeine costs you sleep, how a hard week bleeds into recovery.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[["Recovery", "#13b57e"], ["Sleep", "#7b68ee"], ["Strain", "#ef5a45"], ["Energy", "#eb9d18"]].map(([name, color]) => (
                <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-[#fdfaf3] px-3 py-1 text-[12px] font-medium text-ink-300">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> {name}
                </span>
              ))}
            </div>
          </div>
          <ScoresShowcase />
        </div>
      </section>

      {/* Second product shot — the learning / patterns view. */}
      <section id="patterns" className="border-t border-black/[0.06]">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 sm:py-24 lg:grid-cols-[0.98fr_1.02fr]">
          <div className="order-2 lg:order-1">
            <AppWindow tab="trends">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7b68ee]/15 text-[#7b68ee]"><Sparkles size={14} /></span>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">Patterns · what CURA has learned</div>
              </div>

              {/* HRV trend, rising */}
              <div className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-medium text-ink-200">Overnight HRV</span>
                  <span className="tabular text-[12px] text-ink-400">62 ms · <span className="text-good">↑ 8% vs baseline</span></span>
                </div>
                <svg viewBox="0 0 300 64" className="mt-2 h-16 w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#13b57e" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#13b57e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 44 C 30 46 45 40 70 41 C 100 42 120 30 150 32 C 180 34 200 22 230 18 C 260 14 280 12 300 9 L 300 64 L 0 64 Z" fill="url(#sp)" />
                  <path d="M0 44 C 30 46 45 40 70 41 C 100 42 120 30 150 32 C 180 34 200 22 230 18 C 260 14 280 12 300 9" fill="none" stroke="#13b57e" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              {/* Learned associations */}
              <div className="mt-4 space-y-2.5">
                <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink-100">Late caffeine → shorter sleep</span>
                    <span className="rounded-full bg-[#eb9d18]/15 px-2 py-0.5 text-[10px] font-semibold text-[#b9791a]">Moderate</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-400">~38 min less sleep after caffeine past 3pm · 17 days observed</p>
                </div>
                <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink-100">Sleep → Recovery</span>
                    <span className="tabular text-[12px] font-semibold text-good">r = 0.62</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-good" style={{ width: "62%", opacity: 0.85 }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-500">strong positive relationship · 42 days</p>
                </div>
              </div>
            </AppWindow>
          </div>

          <div className="order-1 lg:order-2">
            <Eyebrow color="#7b68ee">Learns your patterns</Eyebrow>
            <h2 className="mt-4 font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] text-ink-50 sm:text-[2.3rem]">
              It gets to know you — then tells you what actually moves your numbers.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-300">
              Log the life around the data — caffeine, alcohol, training, stress, late meals — and {APP_NAME} quietly
              correlates it against your own physiology. Only associations with enough evidence surface, each with its
              sample size and a confidence rating. No breathless claims, no fake causation — just what
              <span className="text-ink-100"> your numbers</span> actually support.
            </p>
            <Link href="/today" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5b4fd0] underline-offset-4 hover:underline">
              See it on your own data <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-black/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <Eyebrow color="#2298cf">How it works</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] text-ink-50 sm:text-[2.3rem]">
            From raw wearable data to an answer you can act on.
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              { n: "01", t: "Connect your wearable", b: "Sign in with Google to link your Google Health / Fitbit data — sleep, heart rate, HRV and activity." },
              { n: "02", t: "Get scores that fit you", b: "CURA computes Recovery, Sleep, Strain and Energy each day against your own baseline, not a generic one." },
              { n: "03", t: "See the why, and the patterns", b: "Every score breaks down into its factors, with trends and personal patterns — synced across your devices." },
            ].map((s) => (
              <div key={s.n} className="relative border-t border-black/[0.08] pt-5">
                <div className="font-display text-sm font-bold tracking-[0.2em] text-recovery">{s.n}</div>
                <h3 className="mt-3 text-[16px] font-semibold text-ink-50">{s.t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-400">{s.b}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-black/[0.07] bg-[#f6f1e7]/50 p-5">
            <LineChart size={18} className="mt-0.5 shrink-0 text-ink-400" />
            <p className="text-[13.5px] leading-relaxed text-ink-300">
              Plus journaling, nutrition, medication tracking and a body-aware planner that schedules around how
              recovered you are — one place instead of five apps.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="relative overflow-hidden rounded-[1.6rem] border border-black/[0.08] bg-gradient-to-br from-recovery/[0.12] via-[#fdfaf3] to-sleep/[0.10] px-8 py-14 text-center shadow-[0_1px_0_0_rgba(255,255,255,0.7)_inset,0_30px_70px_-40px_rgba(59,46,20,0.45)] sm:px-12">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-8rem] h-64 w-[40rem] -translate-x-1/2 rounded-full bg-recovery/10 blur-3xl" />
          <h2 className="mx-auto max-w-2xl font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] text-ink-50 sm:text-[2.5rem]">
            Stop guessing how you feel. Start knowing.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-ink-300">
            Connect your wearable and get your first set of personalised scores — with the reasons behind every one — in minutes.
          </p>
          <Link href="/today" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-ink-50 px-7 py-3.5 text-sm font-semibold text-ink-950 shadow-lift transition hover:opacity-90">
            Open CURA <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-5 text-xs text-ink-400">Free to use · your data stays yours · not a medical device</p>
        </div>
      </section>

      {/* Data & privacy */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[1.4rem] border border-black/[0.07] bg-gradient-to-b from-[#fefcf8] to-[#fbf7ef] p-7 shadow-[0_1px_0_0_rgba(255,255,255,0.7)_inset,0_4px_10px_-6px_rgba(59,46,20,0.1)]">
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

      {/* Footer */}
      <footer className="border-t border-black/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <Logo size={24} />
                <span className="font-display text-base font-bold tracking-[0.16em] text-ink-100">CURA</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-400">
                Your wearable data, turned into clear daily scores you can actually understand.
              </p>
            </div>
            <div className="flex gap-14">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">Product</div>
                <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-300">
                  <a href="#how" className="hover:text-ink-50">How it works</a>
                  <a href="#patterns" className="hover:text-ink-50">Patterns</a>
                  <Link href="/today" className="hover:text-ink-50">Open the app</Link>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">Legal</div>
                <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-300">
                  <Link href="/privacy" className="hover:text-ink-50">Privacy</Link>
                  <Link href="/terms" className="hover:text-ink-50">Terms</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-black/[0.06] pt-6 text-xs text-ink-500 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} {APP_NAME}. A personal wellness tool, not a medical device.</p>
            <p>Made for people who want the why, not just the number.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
