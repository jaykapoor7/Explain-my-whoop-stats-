"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHealthData } from "@/lib/use-data";
import { RequireData } from "@/components/require-data";
import { Button, Card, SectionHeading } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { generateInsights } from "@/lib/insights";
import { monthlyReport, suggestions } from "@/lib/coach";
import { DayRecord, METRICS, MetricKey } from "@/lib/types";
import { compareGroups, fmt, mean, rollingMean } from "@/lib/stats";
import { cn, formatDate } from "@/lib/utils";

/**
 * Health Report: print-optimized page — use the Print button (or Cmd/Ctrl+P)
 * to save as a polished PDF.
 */

const val = (d: DayRecord, k: MetricKey) => d[k] as number | undefined;
const series = (days: DayRecord[], k: MetricKey) => days.map((d) => val(d, k)).filter((v): v is number => v !== undefined);

function movers(days: DayRecord[]) {
  const keys: MetricKey[] = ["recovery", "hrv", "rhr", "sleepHours", "sleepEfficiency", "strain", "steps", "stress", "mood"];
  const out: { metric: MetricKey; diff: number; pct: number; good: boolean | null }[] = [];
  const cur = days.slice(-30);
  const prev = days.slice(-60, -30);
  for (const k of keys) {
    const a = series(cur, k);
    const b = series(prev, k);
    if (a.length < 10 || b.length < 10) continue;
    const cmp = compareGroups(a, b);
    if (!cmp || Math.abs(cmp.d) < 0.2) continue;
    const meta = METRICS[k];
    out.push({
      metric: k,
      diff: cmp.diff,
      pct: (cmp.diff / Math.abs(mean(b))) * 100,
      good: meta.higherIsBetter === null ? null : meta.higherIsBetter === cmp.diff > 0,
    });
  }
  return {
    improvements: out.filter((m) => m.good === true).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3),
    declines: out.filter((m) => m.good === false).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3),
  };
}

function score(avg: number, lo: number, hi: number): number {
  return Math.round(Math.max(0, Math.min(100, ((avg - lo) / (hi - lo)) * 100)));
}

function ReportBody() {
  const { days } = useHealthData();
  const meta = useApp((s) => s.meta);
  const insights = useMemo(() => generateInsights(days).slice(0, 4), [days]);
  const monthly = useMemo(() => monthlyReport(days), [days]);
  const suggs = useMemo(() => suggestions(days), [days]);
  const { improvements, declines } = useMemo(() => movers(days), [days]);

  const recoveryScore = score(mean(series(days.slice(-30), "recovery")), 20, 85);
  const sleepAvg = mean(series(days.slice(-30), "sleepHours"));
  const effAvg = mean(series(days.slice(-30), "sleepEfficiency"));
  const sleepScore = Math.round(0.6 * score(sleepAvg, 5.5, 8.5) + 0.4 * score(effAvg, 75, 95));

  const trend90 = (k: MetricKey) => {
    const last90 = days.slice(-90);
    const values = last90.map((d) => val(d, k));
    const avg = rollingMean(values, 7);
    return last90.map((d, i) => ({ date: d.date, value: values[i] ?? null, avg: avg[i] }));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Health Report</h1>
          <p className="mt-1 text-sm text-base-400">Print or save as PDF — the page is print-optimized.</p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer size={15} /> Print / Save PDF
        </Button>
      </div>

      <div className="print-report mt-6 space-y-4">
        {/* Overview */}
        <Card className="print-page">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-accent-soft">Recovery Intelligence</div>
              <h2 className="mt-1 text-xl font-semibold">Personal Health Report</h2>
              <p className="mt-1 text-xs text-base-400">
                {formatDate(days[0].date, { month: "long", day: "numeric", year: "numeric" })} –{" "}
                {formatDate(days[days.length - 1].date, { month: "long", day: "numeric", year: "numeric" })} · {days.length} days ·
                source: {meta?.source}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Recovery score", value: recoveryScore, unit: "/100" },
              { label: "Sleep score", value: sleepScore, unit: "/100" },
              { label: "Avg HRV", value: Math.round(mean(series(days.slice(-30), "hrv"))), unit: "ms" },
              { label: "Avg RHR", value: Math.round(mean(series(days.slice(-30), "rhr"))), unit: "bpm" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-2xl font-semibold tabular">{isFinite(s.value) ? s.value : "–"}<span className="text-sm text-base-400">{s.unit}</span></div>
                <div className="mt-0.5 text-[11px] text-base-400">{s.label} (30d)</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Movers */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="print-page">
            <h3 className="text-sm font-semibold text-[#6ee7b7]">Biggest improvements (30d vs prior)</h3>
            <div className="mt-3 space-y-2">
              {improvements.length ? improvements.map((m) => (
                <div key={m.metric} className="flex items-center justify-between text-sm">
                  <span className="text-base-200">{METRICS[m.metric].label}</span>
                  <span className="tabular font-medium text-[#6ee7b7]">
                    {m.diff > 0 ? "+" : ""}{fmt(m.diff, METRICS[m.metric].decimals)}{METRICS[m.metric].unit}
                  </span>
                </div>
              )) : <p className="text-xs text-base-400">No significant improvements this period.</p>}
            </div>
          </Card>
          <Card className="print-page">
            <h3 className="text-sm font-semibold text-[#ffa2b0]">Biggest declines (30d vs prior)</h3>
            <div className="mt-3 space-y-2">
              {declines.length ? declines.map((m) => (
                <div key={m.metric} className="flex items-center justify-between text-sm">
                  <span className="text-base-200">{METRICS[m.metric].label}</span>
                  <span className="tabular font-medium text-[#ffa2b0]">
                    {m.diff > 0 ? "+" : ""}{fmt(m.diff, METRICS[m.metric].decimals)}{METRICS[m.metric].unit}
                  </span>
                </div>
              )) : <p className="text-xs text-base-400">No significant declines this period. Nice.</p>}
            </div>
          </Card>
        </div>

        {/* Top insights */}
        <Card className="print-page">
          <h3 className="text-sm font-semibold">Top insights</h3>
          <div className="mt-3 space-y-3">
            {insights.map((ins) => (
              <div key={ins.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <p className="text-sm font-medium leading-snug">{ins.headline}</p>
                <p className="mt-1 text-xs text-base-400">
                  <span className="capitalize">{ins.confidence}</span> confidence · {ins.evidence[0]}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Heart trends */}
        <Card className="print-page">
          <h3 className="text-sm font-semibold">Heart trends · 90 days</h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-base-400">HRV</div>
              <TrendChart data={trend90("hrv")} metric="hrv" height={150} />
            </div>
            <div>
              <div className="mb-1 text-xs text-base-400">Resting heart rate</div>
              <TrendChart data={trend90("rhr")} metric="rhr" height={150} />
            </div>
          </div>
        </Card>

        {/* Monthly averages */}
        {monthly && (
          <Card className="print-page">
            <h3 className="text-sm font-semibold">Monthly averages</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {monthly.stats.map((s) => (
                <div key={s.label}>
                  <div className="text-[11px] text-base-400">{s.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-base font-semibold tabular">{s.value}</span>
                    <span className={cn("text-[11px] tabular", s.good === true ? "text-[#6ee7b7]" : s.good === false ? "text-[#ffa2b0]" : "text-base-400")}>
                      {s.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Next steps */}
        <Card className="print-page">
          <h3 className="text-sm font-semibold">Suggested next steps</h3>
          <ol className="mt-3 space-y-2">
            {suggs.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent-soft">
                  {i + 1}
                </span>
                <span>
                  <span className="text-base-100">{s.text}</span>{" "}
                  <span className="text-xs text-base-400">— {s.why}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-base-400">
            Generated locally by Recovery Intelligence from your own wearable data. Patterns shown are correlations in
            observational data and are not medical advice or a diagnosis. Discuss persistent concerning trends with a
            qualified healthcare professional.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <RequireData>
      <ReportBody />
    </RequireData>
  );
}
