"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Beaker,
  Lock,
  MessageCircle,
  Sparkles,
  Upload,
  Waves,
} from "lucide-react";
import { LinkButton, FadeIn } from "@/components/ui";

const PROVIDERS = ["WHOOP", "Apple Health", "Fitbit", "Garmin", "Oura", "Polar", "Coros", "Samsung Health"];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI Insights Engine",
    body: "Automatically scans months of data for statistically meaningful relationships — then explains them in plain English with evidence, confidence levels and a suggested experiment.",
    example: "“Your HRV is consistently higher after sleeping more than 7 hours.”",
  },
  {
    icon: MessageCircle,
    title: "Ask Your Health Data",
    body: "A conversation with your own physiology. Every answer is computed from your uploaded data — with the reasoning shown, never invented.",
    example: "“Why was my recovery low last Tuesday?”",
  },
  {
    icon: BarChart3,
    title: "Correlation Explorer",
    body: "Interactive scatter plots, trend lines and honest statistics for any pair of variables — sleep vs HRV, alcohol vs recovery, training load vs sleep.",
    example: "Sleep duration ↔ next-morning HRV, r = 0.54",
  },
  {
    icon: Beaker,
    title: "Experiment Mode",
    body: "Cut caffeine, start creatine, walk after dinner — then let the data speak. Before/after analysis with effect sizes, clearly separating correlation from causation.",
    example: "“Two dry weeks: HRV +6 ms, an effect unlikely to be chance.”",
  },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/[0.13] blur-[140px]" />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
            <Waves size={17} strokeWidth={2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Recovery Intelligence</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/privacy" className="hidden rounded-full px-4 py-2 text-sm text-base-300 transition hover:text-white sm:block">
            Privacy
          </Link>
          <LinkButton href="/dashboard" variant="ghost" size="sm">
            Open app
          </LinkButton>
        </nav>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-base-300">
            <Sparkles size={13} className="text-accent-soft" />
            The intelligence layer for your wearable data
          </span>
          <h1 className="text-gradient mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Understand Your Body, Not Just Your Metrics.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-base-300 sm:text-lg">
            Upload your wearable data and let AI uncover patterns, answer questions, explain
            trends, and reveal insights hidden inside months of health data.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/upload" size="lg">
              <Upload size={16} /> Upload Data
            </LinkButton>
            <LinkButton href="/dashboard?demo=1" variant="ghost" size="lg">
              Demo Dashboard <ArrowRight size={16} />
            </LinkButton>
          </div>
        </motion.div>

        <FadeIn delay={0.25} className="mt-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-base-400">Works with exports from</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm font-medium text-base-300/80">
            {PROVIDERS.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* product preview */}
      <FadeIn className="relative z-10 mx-auto max-w-5xl px-6">
        <div className="glass rounded-2xl p-2 shadow-glow">
          <div className="rounded-xl border border-white/[0.06] bg-base-950/90 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-base-400">This morning</div>
                <div className="mt-1 text-2xl font-semibold">
                  Recovery <span className="text-[#5ecb5e]">78%</span> — primed for a big day
                </div>
              </div>
              <span className="rounded-full bg-status-good/15 px-3 py-1 text-xs font-medium text-[#5ecb5e]">Green</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "HRV", value: "72 ms", note: "+9 vs baseline" },
                { label: "Resting HR", value: "51 bpm", note: "−2 vs baseline" },
                { label: "Sleep", value: "7h 52m", note: "98% of need" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="text-xs text-base-400">{s.label}</div>
                  <div className="mt-1 text-xl font-semibold tabular">{s.value}</div>
                  <div className="mt-0.5 text-xs text-[#5ecb5e]">{s.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.07] p-4 text-sm leading-relaxed text-base-200">
              <span className="font-medium text-accent-soft">Insight · high confidence — </span>
              Your HRV averages 11 ms higher after nights with 7+ hours of sleep (89 nights,
              p &lt; 0.001). Suggested experiment: protect a 7.5h sleep window for the next two weeks.
            </div>
          </div>
        </div>
      </FadeIn>

      {/* features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Your wearable shows you <em className="not-italic text-base-400">what</em>.
            <br />
            This shows you <em className="not-italic text-accent-soft">why</em>.
          </h2>
          <p className="mt-4 text-base-300">
            Recovery Intelligence doesn&apos;t replace your wearable&apos;s app — it&apos;s the analytical
            layer on top: correlations, explanations, and experiments across every platform you use.
          </p>
        </FadeIn>
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.06}>
              <div className="card group h-full p-6 transition-colors hover:border-white/[0.12]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent-soft">
                  <f.icon size={19} strokeWidth={1.8} />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-base-300">{f.body}</p>
                <p className="mt-4 rounded-lg bg-white/[0.04] px-3 py-2 text-xs italic text-base-400">{f.example}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* privacy */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <FadeIn>
          <div className="card flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-status-good/12 text-[#5ecb5e]">
              <Lock size={22} strokeWidth={1.8} />
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Your data never leaves your device.</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-base-300">
                Files are parsed and analyzed locally in your browser. Nothing is uploaded to a
                server, you can delete everything with one click, and your health data is never
                used to train AI models.
              </p>
            </div>
            <Link href="/privacy" className="text-sm font-medium text-accent-soft hover:underline">
              How privacy works →
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* footer CTA */}
      <section className="relative z-10 border-t border-white/[0.06] px-6 py-20 text-center">
        <FadeIn>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Six months of data has a story. Hear it.
          </h2>
          <div className="mt-7 flex items-center justify-center gap-3">
            <LinkButton href="/upload" size="lg">
              <Upload size={16} /> Upload Data
            </LinkButton>
            <LinkButton href="/dashboard?demo=1" variant="ghost" size="lg">
              Try the demo
            </LinkButton>
          </div>
          <p className="mt-12 text-xs text-base-400">
            Recovery Intelligence is a data analysis tool, not a medical device. It explains
            patterns in your data — it does not diagnose or treat any condition.
          </p>
        </FadeIn>
      </section>
    </div>
  );
}
