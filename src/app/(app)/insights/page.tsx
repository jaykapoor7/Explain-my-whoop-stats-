"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Beaker, ChevronDown, FlaskConical, Microscope, Sparkles } from "lucide-react";
import Link from "next/link";
import { useHealthData } from "@/lib/use-data";
import { RequireData } from "@/components/require-data";
import { Badge, Card, FadeIn } from "@/components/ui";
import { CompareBars, CorrelationScatter, TrendChart } from "@/components/charts";
import { generateInsights } from "@/lib/insights";
import { Insight, InsightCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rollingMean } from "@/lib/stats";

const CATEGORIES: { id: InsightCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "worklife", label: "Work & Life" },
  { id: "sleep", label: "Sleep" },
  { id: "recovery", label: "Recovery" },
  { id: "heart", label: "Heart" },
  { id: "activity", label: "Activity" },
  { id: "lifestyle", label: "Lifestyle" },
];

const CONFIDENCE_TONE = { high: "good", moderate: "warning", exploratory: "neutral" } as const;
const CONFIDENCE_COPY = {
  high: "Strong statistical support in your data",
  moderate: "Solid signal, but more data would firm it up",
  exploratory: "Interesting pattern — treat as a hypothesis",
} as const;

function InsightChart({ insight }: { insight: Insight }) {
  const c = insight.chart;
  if (c.kind === "scatter")
    return <CorrelationScatter points={c.points} xKey={c.xKey} yKey={c.yKey} trend={c.trend} height={260} />;
  if (c.kind === "compare") return <CompareBars groups={c.groups} metric={c.metric} height={220} />;
  const avg = rollingMean(c.points.map((p) => p.value), 7);
  return (
    <TrendChart
      data={c.points.map((p, i) => ({ date: p.date, value: p.value, avg: avg[i] }))}
      metric={c.metric}
      height={220}
    />
  );
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <FadeIn delay={Math.min(index * 0.05, 0.3)}>
      <Card className="overflow-hidden p-0">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent-soft">
              <Sparkles size={15} />
            </span>
            <div>
              <p className="font-medium leading-snug">{insight.headline}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={CONFIDENCE_TONE[insight.confidence]} className="capitalize">
                  {insight.confidence} confidence
                </Badge>
                <span className="text-xs capitalize text-base-400">{insight.category}</span>
                <span className="text-xs text-base-400">n = {insight.stats.n}</span>
              </div>
            </div>
          </div>
          <ChevronDown size={16} className={cn("mt-1 shrink-0 text-base-400 transition-transform", open && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              <div className="border-t border-white/[0.06] px-5 py-5">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-base-400">
                      <Microscope size={13} /> Evidence
                    </h4>
                    <ul className="mt-2 space-y-1.5">
                      {insight.evidence.map((e, i) => (
                        <li key={i} className="flex gap-2 text-sm text-base-200">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-soft" />
                          {e}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-base-400">{CONFIDENCE_COPY[insight.confidence]}.</p>

                    <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-base-400">Why this happens</h4>
                    <p className="mt-2 text-sm leading-relaxed text-base-200">{insight.explanation}</p>

                    <div className="mt-5 rounded-xl border border-accent/20 bg-accent/[0.06] p-4">
                      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-soft">
                        <FlaskConical size={13} /> Suggested experiment
                      </h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-base-200">{insight.experiment}</p>
                      <Link href="/experiments" className="mt-2 inline-block text-xs font-medium text-accent-soft hover:underline">
                        Set it up in Experiment Mode →
                      </Link>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-base-400">Visualization</h4>
                    <InsightChart insight={insight} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </FadeIn>
  );
}

function InsightsBody() {
  const { days, hasCalendar } = useHealthData();
  const [category, setCategory] = useState<InsightCategory | "all">("all");
  const insights = useMemo(() => generateInsights(days), [days]);
  const filtered = category === "all" ? insights : insights.filter((i) => i.category === category);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Discoveries</h1>
          <p className="mt-1 text-sm text-base-400">
            The engine continuously scans your {days.length} days
            {hasCalendar ? " — including calendar context —" : ""} for statistically meaningful patterns. {insights.length} surfaced. Correlations, not diagnoses.
          </p>
        </div>
      </div>

      {!hasCalendar && (
        <Link
          href="/upload#calendar"
          className="mt-4 block rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3 text-sm text-base-200 transition hover:border-accent/40"
        >
          <span className="font-medium text-accent-soft">Connect your calendar</span> to unlock work-life
          discoveries — meeting load vs HRV, early meetings vs recovery, travel signatures and more. Parsed locally,
          never uploaded.
        </Link>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              category === c.id ? "bg-white text-base-950" : "border border-white/10 text-base-300 hover:bg-white/[0.06]"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {filtered.map((ins, i) => (
          <InsightCard key={ins.id} insight={ins} index={i} />
        ))}
        {!filtered.length && (
          <Card className="py-10 text-center text-sm text-base-400">
            <Beaker className="mx-auto mb-3 text-base-400" size={22} />
            No {category === "all" ? "" : `${category} `}insights cleared the statistical bar yet. More days of data —
            especially journal entries like alcohol, caffeine and stress — give the engine more to work with.
          </Card>
        )}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-base-400">
        How to read this: every insight is an observed association in your own data, ranked by statistical confidence
        (effect size, sample size and p-value). Association is not causation — the suggested experiments are how you
        move from “correlated” toward “actually works for me.” Nothing here is medical advice.
      </p>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <RequireData>
      <InsightsBody />
    </RequireData>
  );
}
