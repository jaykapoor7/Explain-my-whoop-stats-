"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, PageHeader, Section, SkeletonPage } from "@/components/ui";
import { TrendArea } from "@/components/charts";
import { useHealth } from "@/lib/data/use-health";
import { correlate } from "@/lib/insights/insights";
import { ScoredDay } from "@/lib/scoring/engine";
import { cn, fmtNum } from "@/lib/format";

const RANGES = [7, 30, 90] as const;

const SERIES: { key: string; label: string; unit: string; color: string; get: (s: ScoredDay) => number }[] = [
  { key: "recovery", label: "Recovery", unit: "", color: "#38d39f", get: (s) => s.recovery.score },
  { key: "energy", label: "Energy", unit: "", color: "#f6b83b", get: (s) => s.energy.score },
  { key: "sleepMin", label: "Sleep (min)", unit: " min", color: "#8b8cff", get: (s) => s.day.sleep.asleepMin },
  { key: "hrv", label: "HRV (ms)", unit: " ms", color: "#7dd3fc", get: (s) => s.day.hrv.rmssdMs },
  { key: "rhr", label: "Resting HR", unit: " bpm", color: "#e089d2", get: (s) => s.day.rhr.bpm },
  { key: "strain", label: "Strain", unit: "", color: "#ff7a5c", get: (s) => s.strain.score },
  { key: "steps", label: "Steps", unit: "", color: "#8ee06a", get: (s) => s.day.steps },
  { key: "kcal", label: "Calories in", unit: " kcal", color: "#5cc8ff", get: (s) => s.nutrition.kcal },
  { key: "weight", label: "Weight (kg)", unit: " kg", color: "#c9b98a", get: (s) => s.day.weightKg ?? NaN },
];

const RELATIONSHIPS: { a: string; b: string; label: string; lag: 0 | 1 }[] = [
  { a: "sleepScore", b: "recovery", label: "Sleep → Recovery", lag: 0 },
  { a: "sleepScore", b: "energy", label: "Sleep → Energy", lag: 0 },
  { a: "recovery", b: "energy", label: "Recovery → Energy", lag: 0 },
  { a: "hrv", b: "recovery", label: "HRV → Recovery", lag: 0 },
  { a: "sleepMin", b: "mood", label: "Sleep → Mood", lag: 0 },
];

export default function TrendsPage() {
  const data = useHealth();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [seriesKey, setSeriesKey] = useState("recovery");

  const active = SERIES.find((s) => s.key === seriesKey)!;
  const chart = useMemo(
    () =>
      !data.hydrated
        ? []
        : data.days.slice(-range).map((s) => {
            const v = active.get(s);
            return { date: s.day.date, value: isFinite(v) ? v : null };
          }),
    [data.hydrated, data.days, range, active]
  );

  if (!data.hydrated) return <SkeletonPage />;

  const window = data.days.slice(-range);
  const prev = data.days.slice(-range * 2, -range);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : NaN);
  const cur = mean(window.map(active.get).filter(isFinite));
  const before = mean(prev.map(active.get).filter(isFinite));
  const shift = isFinite(before) && before !== 0 ? ((cur - before) / before) * 100 : NaN;

  return (
    <div className="animate-fadeUp">
      <PageHeader
        title="Trends & Insights"
        sub="What is changing — and what appears to affect you."
        right={
          <div className="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn("px-3 py-1.5 font-medium", range === r ? "bg-white/[0.1] text-ink-50" : "text-ink-400")}>
                {r}d
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-5 flex flex-wrap gap-1.5">
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => setSeriesKey(s.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              seriesKey === s.key ? "text-ink-950" : "border border-white/12 text-ink-300 hover:bg-white/[0.06]"
            )}
            style={seriesKey === s.key ? { background: s.color } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink-100">{active.label} · last {range} days</span>
          <span className="tabular text-xs text-ink-400">
            avg <span className="text-ink-100">{fmtNum(cur, cur < 100 ? 1 : 0)}</span>
            {isFinite(shift) && (
              <span className={cn("ml-2", Math.abs(shift) < 1 ? "text-ink-400" : shift > 0 ? "text-good" : "text-bad")}>
                {shift > 0 ? "+" : ""}
                {fmtNum(shift, 1)}% vs prior {range}d
              </span>
            )}
          </span>
        </div>
        <div className="mt-3">
          <TrendArea data={chart} color={active.color} unit={active.unit} name={active.label} height={230} />
        </div>
      </Card>

      <Section title="What appears to affect you" sub="Observed associations with sample sizes — never causation">
        {data.insights.length ? (
          <div className="space-y-3">
            {data.insights.map((i) => (
              <Card key={i.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-ink-200">
                  <Sparkles size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-100">{i.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-400">{i.detail}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    i.strength === "clear" ? "bg-good/15 text-good" : i.strength === "moderate" ? "bg-warn/15 text-warn" : "bg-white/[0.07] text-ink-300"
                  )}
                >
                  {i.strength}
                </span>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-5 text-sm text-ink-400">Not enough logged data yet — patterns appear once behaviors repeat.</Card>
        )}
      </Section>

      <Section title="Relationships" sub="Correlation between paired metrics over your full history">
        <div className="grid gap-3 sm:grid-cols-2">
          {RELATIONSHIPS.map((rel) => {
            const c = correlate(data.days, rel.a, rel.b, rel.lag);
            if (!c) return null;
            const strength = Math.abs(c.r) >= 0.5 ? "strong" : Math.abs(c.r) >= 0.3 ? "moderate" : "weak";
            return (
              <Card key={rel.label} className="p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-ink-100">{rel.label}</span>
                  <span className="tabular text-xs text-ink-400">r = {fmtNum(c.r, 2)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  {strength} {c.r >= 0 ? "positive" : "negative"} relationship · n = {c.n} days
                </p>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
