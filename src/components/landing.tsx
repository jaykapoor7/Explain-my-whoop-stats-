"use client";

import { Activity, HeartPulse, LineChart, LogIn, Moon, NotebookPen, Sparkles } from "lucide-react";
import { useAccount } from "@/components/account";

const FEATURES = [
  { icon: HeartPulse, color: "#13b57e", title: "Recovery, sleep, strain & energy", body: "One clear score for each, every morning — so you know what your body can handle today." },
  { icon: Sparkles, color: "#eb9d18", title: "The “why” behind every number", body: "Plain-English explanations that show exactly what lifted or dragged each score." },
  { icon: LineChart, color: "#2298cf", title: "Your own patterns", body: "CURA learns from your history — trends, baselines and what actually moves your recovery." },
  { icon: NotebookPen, color: "#7b68ee", title: "Everything in one place", body: "Journal, medication, nutrition and a planner that schedules around how recovered you are." },
];

export function Landing() {
  const account = useAccount();
  return (
    <div className="animate-fadeUp">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-black/[0.05] bg-gradient-to-br from-recovery/[0.10] via-transparent to-sleep/[0.10] px-6 py-14 text-center sm:px-10 sm:py-20">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-recovery/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-sleep/20 blur-3xl" />
        <div className="relative">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-recovery to-sleep text-[#241f18] shadow-lift">
            <Activity size={26} strokeWidth={2.4} />
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-[0.18em] text-ink-50 sm:text-7xl">CURA</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-snug text-ink-300 sm:text-xl">
            Your body, clearly explained. Turn your wearable into daily scores you actually understand — and the patterns behind them.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={account.signIn}
              className="flex items-center justify-center gap-2 rounded-full bg-recovery px-7 py-3.5 text-[15px] font-semibold text-[#241f18] shadow-lift transition hover:brightness-[1.03]"
            >
              <LogIn size={17} /> Sign in with Google
            </button>
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Moon size={12} /> Works with Fitbit &amp; Google Health · sign in on any device and everything follows you.
            </p>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card flex items-start gap-3.5 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${f.color}1f`, color: f.color }}>
              <f.icon size={19} />
            </span>
            <div>
              <h3 className="font-display text-[15px] font-semibold text-ink-50">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-400">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
