"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const HeroOrb = dynamic(() => import("@/components/hero-orb"), {
  ssr: false,
  loading: () => null,
});
import {
  ArrowRight,
  BarChart3,
  Lock,
  Plug,
  Sparkles,
  Target,
  Upload,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { LinkButton, FadeIn } from "@/components/ui";

const PROVIDERS = ["WHOOP", "Apple Health", "Fitbit", "Garmin", "Oura", "Polar", "Coros", "Samsung Health", "Google Calendar", "Apple Calendar"];

const FEATURES: {
  icon: React.ElementType;
  color: string;
  title: string;
  body: string;
  example: string;
}[] = [
  {
    icon: Sparkles,
    color: "#7c6bff",
    title: "Understand your data",
    body: "The engine scans your history for the patterns that actually matter and explains them in plain English — no dashboards to decode, just what's happening and why.",
    example: "“Your HRV is higher after nights with 7+ hours of sleep.”",
  },
  {
    icon: BarChart3,
    color: "#2dd4ee",
    title: "Explore correlations",
    body: "Pick any two things — sleep vs HRV, protein vs recovery, alcohol vs sleep — and see how they move together, with an honest read on strength and causation.",
    example: "Sleep duration ↔ next-morning HRV, r = 0.54",
  },
  {
    icon: UtensilsCrossed,
    color: "#34d399",
    title: "Track nutrition",
    body: "Log food in seconds with a built-in database, hit your calorie and macro goals, and watch what you eat flow straight into the analysis.",
    example: "1,780 kcal left · 37 / 160 g protein",
  },
  {
    icon: Target,
    color: "#fbbf24",
    title: "Set your goals",
    body: "One place for the targets that matter — calories, protein, sleep, recovery, steps — with your progress measured against them automatically.",
    example: "Sleep 7.8 / 8 h · Recovery 62 / 60% ✓",
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
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-vivid-violet to-vivid-cyan text-white shadow-glow">
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
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-10 text-center sm:pt-14">
        {/* 3D orb — the product's living centerpiece */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 mx-auto h-[520px] max-w-3xl opacity-90 sm:h-[600px]">
          <HeroOrb />
        </div>

        <motion.div
          className="relative z-10 pt-40 sm:pt-48"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <span className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-base-200">
            <Sparkles size={13} className="text-vivid-cyan" />
            Your personal health intelligence engine
          </span>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight [filter:drop-shadow(0_4px_28px_rgba(10,12,45,0.95))] sm:text-6xl">
            <span className="text-gradient">Understand Your Body,</span>
            <br />
            <span className="text-gradient-vivid">Not Just Your Metrics.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-base-200 [text-shadow:0_2px_18px_rgba(10,12,45,0.95)] sm:text-lg">
            Your wearable records what happened. Recovery Intelligence connects it to your real
            life — calendar, meetings, travel, training, late nights — and explains{" "}
            <span className="text-white">why</span> your metrics changed.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/connections" size="lg">
              <Plug size={16} /> Connect a Device
            </LinkButton>
            <LinkButton href="/upload" variant="ghost" size="lg">
              <Upload size={16} /> Upload Data <ArrowRight size={16} />
            </LinkButton>
          </div>
        </motion.div>

        <FadeIn delay={0.25} className="relative z-10 mt-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-base-400">Works with exports from</p>
          <div className="relative mt-4 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div className="flex w-max animate-marquee items-center gap-10 text-sm font-medium text-base-200/90">
              {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
                <span key={`${p}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: ["#7c6bff", "#2dd4ee", "#fb7bb8", "#34d399", "#fbbf24"][i % 5] }}
                  />
                  {p}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* product preview */}
      <FadeIn className="relative z-10 mx-auto max-w-5xl px-6">
        <div className="glass rounded-2xl p-2 shadow-glow">
          <div className="rounded-xl border border-white/[0.06] bg-base-900/70 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-base-400">This morning</div>
                <div className="mt-1 text-2xl font-semibold">
                  Recovery <span className="text-[#6ee7b7]">78%</span> — primed for a big day
                </div>
              </div>
              <span className="rounded-full bg-status-good/15 px-3 py-1 text-xs font-medium text-[#6ee7b7]">Green</span>
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
                  <div className="mt-0.5 text-xs text-[#6ee7b7]">{s.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.07] p-4 text-sm leading-relaxed text-base-200">
              <span className="font-medium text-accent-soft">Discovery · high confidence — </span>
              Yesterday: 7 meetings, the first at 8 AM. Your HRV runs 9 ms lower on 5+ meeting days
              (61 workdays, p &lt; 0.001). Suggested experiment: block 9–10 AM as meeting-free for two weeks.
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
            The wearable already records the data. The question every user actually has is:{" "}
            <em>&ldquo;What in my life is causing these changes?&rdquo;</em> Recovery Intelligence answers it by
            connecting your metrics to their context — schedule, travel, training, habits.
          </p>
        </FadeIn>
        <div className="mt-14 grid gap-4 [perspective:1200px] sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -8, rotateX: 4, rotateY: -3, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="card relative h-full overflow-hidden p-6 [transform-style:preserve-3d]"
                style={{ boxShadow: undefined }}
              >
                <span
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
                  style={{ background: f.color }}
                />
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${f.color}, ${f.color}88)` }}
                >
                  <f.icon size={20} strokeWidth={1.9} />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-base-300">{f.body}</p>
                <p
                  className="mt-4 rounded-lg border px-3 py-2 text-xs italic text-base-200"
                  style={{ borderColor: `${f.color}40`, background: `${f.color}14` }}
                >
                  {f.example}
                </p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* privacy */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <FadeIn>
          <div className="card flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-status-good/12 text-[#6ee7b7]">
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
            <LinkButton href="/connections" size="lg">
              <Plug size={16} /> Connect a Device
            </LinkButton>
            <LinkButton href="/upload" variant="ghost" size="lg">
              Upload Data
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
