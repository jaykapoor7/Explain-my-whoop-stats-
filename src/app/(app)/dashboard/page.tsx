"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { RequireData } from "@/components/require-data";
import { Badge, Card, CardTitle, FadeIn, SectionHeading, StatTile } from "@/components/ui";
import { CompareBars, DistributionChart, SleepStagesChart, TrendChart, ZonesChart } from "@/components/charts";
import { DayRecord, METRICS, MetricKey } from "@/lib/types";
import { fmt, mean, rollingMean } from "@/lib/stats";
import { formatDate, hourLabel, recoveryColor } from "@/lib/utils";
import { generateInsights } from "@/lib/insights";
import { ArrowRight, Sparkles } from "lucide-react";

const val = (d: DayRecord, k: MetricKey) => d[k] as number | undefined;

function trendData(days: DayRecord[], k: MetricKey) {
  const values = days.map((d) => val(d, k));
  const avg = rollingMean(values, 7);
  return days.map((d, i) => ({ date: d.date, value: values[i] ?? null, avg: avg[i] }));
}

function deltaVsPrior(days: DayRecord[], k: MetricKey, window = 30): { delta: string; good: boolean | null } {
  const cur = days.slice(-window).map((d) => val(d, k)).filter((v): v is number => v !== undefined);
  const prev = days.slice(-window * 2, -window).map((d) => val(d, k)).filter((v): v is number => v !== undefined);
  if (cur.length < 5 || prev.length < 5) return { delta: "", good: null };
  const diff = mean(cur) - mean(prev);
  const meta = METRICS[k];
  const good = meta.higherIsBetter === null ? null : meta.higherIsBetter === diff > 0;
  return { delta: `${diff >= 0 ? "+" : ""}${fmt(diff, meta.decimals)}${meta.unit}`, good };
}

function DemoLoader() {
  const params = useSearchParams();
  const loadDemo = useApp((s) => s.loadDemo);
  const hydrated = useApp((s) => s.hydrated);
  const hasData = useApp((s) => s.days.length > 0);
  useEffect(() => {
    if (hydrated && !hasData && params.get("demo") === "1") loadDemo();
  }, [hydrated, hasData, params, loadDemo]);
  return null;
}

function Dashboard() {
  const days = useApp((s) => s.days);
  const last90 = useMemo(() => days.slice(-90), [days]);
  const insights = useMemo(() => generateInsights(days).slice(0, 2), [days]);

  const recoveries = last90.map((d) => d.recovery).filter((v): v is number => v !== undefined);
  const sorted = [...last90].filter((d) => d.recovery !== undefined).sort((a, b) => b.recovery! - a.recovery!);
  const best = sorted.slice(0, 5);
  const worst = sorted.slice(-5).reverse();

  const sleepAvg = mean(last90.map((d) => d.sleepHours).filter((v): v is number => v !== undefined));
  const debtNow = [...days].reverse().find((d) => d.sleepDebtHours !== undefined)?.sleepDebtHours;
  const effAvg = mean(last90.map((d) => d.sleepEfficiency).filter((v): v is number => v !== undefined));
  const consAvg = mean(last90.map((d) => d.sleepConsistency).filter((v): v is number => v !== undefined));
  const bedtimes = last90.map((d) => d.bedtimeHour).filter((v): v is number => v !== undefined);
  const wakes = last90.map((d) => d.wakeHour).filter((v): v is number => v !== undefined);

  const workouts = last90.flatMap((d) => d.workouts ?? []);
  const zoneTotals = [0, 0, 0, 0, 0];
  for (const w of workouts) w.zones?.forEach((m, i) => (zoneTotals[i] += m));
  const sportCounts = workouts.reduce<Record<string, number>>((acc, w) => {
    acc[w.sport] = (acc[w.sport] ?? 0) + 1;
    return acc;
  }, {});
  const topSports = Object.entries(sportCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const strainAvg = mean(last90.map((d) => d.strain).filter((v): v is number => v !== undefined));
  const load7 = mean(days.slice(-7).map((d) => d.strain).filter((v): v is number => v !== undefined));
  const load28 = mean(days.slice(-28).map((d) => d.strain).filter((v): v is number => v !== undefined));
  const acr = isFinite(load7) && isFinite(load28) && load28 > 0 ? load7 / load28 : NaN;

  const lifestyleKeys: MetricKey[] = ["alcoholDrinks", "caffeineMg", "stress", "mood", "proteinG", "screenTimeMin"];
  const lifestyleAvailable = lifestyleKeys.filter((k) => last90.some((d) => val(d, k) !== undefined));

  const today = days[days.length - 1];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-base-400">
            Last {last90.length} days · most recent: {formatDate(today.date, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 text-xs text-base-400">
          {(["recovery", "sleep", "heart", "activity", "lifestyle"] as const).map((s) => (
            <a key={s} href={`#${s}`} className="rounded-full border border-white/10 px-3 py-1.5 capitalize transition hover:bg-white/[0.05] hover:text-white">
              {s}
            </a>
          ))}
        </div>
      </div>

      {/* Top insights strip */}
      {insights.length > 0 && (
        <FadeIn className="mt-6">
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((ins) => (
              <Link key={ins.id} href="/insights" className="group">
                <div className="card flex h-full items-start gap-3 border-accent/15 bg-accent/[0.05] p-4 transition hover:border-accent/30">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-accent-soft" />
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-snug">{ins.headline}</p>
                    <p className="mt-1 text-xs text-base-400 capitalize">{ins.confidence} confidence · tap to explore</p>
                  </div>
                  <ArrowRight size={14} className="mt-1 text-base-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </Link>
            ))}
          </div>
        </FadeIn>
      )}

      {/* ============ RECOVERY ============ */}
      <SectionHeading id="recovery" title="Recovery" subtitle="How ready your body is to take on strain" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today"
          value={today.recovery !== undefined ? String(today.recovery) : "–"}
          unit="%"
          sub={today.recovery !== undefined ? (today.recovery >= 67 ? "Green — go hard" : today.recovery >= 34 ? "Yellow — moderate" : "Red — recover") : undefined}
        />
        <StatTile label="90-day average" value={fmt(mean(recoveries), 0)} unit="%" {...deltaLabel(days, "recovery")} />
        <StatTile label="Green days" value={String(recoveries.filter((r) => r >= 67).length)} sub={`of ${recoveries.length} scored days`} />
        <StatTile label="Red days" value={String(recoveries.filter((r) => r < 34).length)} sub={`of ${recoveries.length} scored days`} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Recovery trend · 90 days</CardTitle>
          <div className="mt-4">
            <TrendChart data={trendData(last90, "recovery")} metric="recovery" />
          </div>
        </Card>
        <Card>
          <CardTitle>Distribution</CardTitle>
          <div className="mt-4">
            <DistributionChart values={recoveries} metric="recovery" />
          </div>
        </Card>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card>
          <CardTitle>Best recovery days</CardTitle>
          <DayList days={best} />
        </Card>
        <Card>
          <CardTitle>Worst recovery days</CardTitle>
          <DayList days={worst} />
        </Card>
      </div>

      {/* ============ SLEEP ============ */}
      <SectionHeading id="sleep" title="Sleep" subtitle="Duration, quality, structure and timing" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Avg sleep" value={fmt(sleepAvg, 1)} unit="h/night" {...deltaLabel(days, "sleepHours")} />
        <StatTile label="Sleep debt" value={fmt(debtNow, 1)} unit="h" sub={debtNow !== undefined && debtNow > 2 ? "Building — prioritize early nights" : "Under control"} />
        <StatTile label="Efficiency" value={fmt(effAvg, 0)} unit="%" {...deltaLabel(days, "sleepEfficiency")} />
        <StatTile label="Consistency" value={isFinite(consAvg) ? fmt(consAvg, 0) : "–"} unit="%" sub="Same-time-every-night score" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Sleep stages · last 30 nights</CardTitle>
          <div className="mt-4">
            <SleepStagesChart
              data={days.slice(-30).map((d) => ({ date: d.date, deep: d.deepHours, rem: d.remHours, light: d.lightHours, awake: d.awakeHours }))}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-base-400">
            {[
              ["Deep", "#1c5cab"],
              ["REM", "#9085e9"],
              ["Light", "#6da7ec"],
              ["Awake", "#52514e"],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: color }} /> {label}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Sleep timing</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs text-base-400">Typical bedtime</div>
              <div className="mt-0.5 text-2xl font-semibold tabular">{bedtimes.length ? hourLabel(mean(bedtimes)) : "–"}</div>
            </div>
            <div>
              <div className="text-xs text-base-400">Typical wake time</div>
              <div className="mt-0.5 text-2xl font-semibold tabular">{wakes.length ? hourLabel(mean(wakes)) : "–"}</div>
            </div>
            <div>
              <div className="text-xs text-base-400">Bedtime spread (90d)</div>
              <div className="mt-0.5 text-2xl font-semibold tabular">
                {bedtimes.length ? `±${fmt((Math.max(...bedtimes) - Math.min(...bedtimes)) / 2, 1)}h` : "–"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-base-400">A tighter window generally improves efficiency and consistency scores.</p>
            </div>
          </div>
        </Card>
      </div>
      <Card className="mt-3">
        <CardTitle>Sleep duration trend</CardTitle>
        <div className="mt-4">
          <TrendChart data={trendData(last90, "sleepHours")} metric="sleepHours" height={190} />
        </div>
      </Card>

      {/* ============ HEART ============ */}
      <SectionHeading id="heart" title="Heart" subtitle="Autonomic recovery and cardiovascular strain" />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="HRV (90d avg)" value={fmt(mean(last90.map((d) => d.hrv).filter((v): v is number => v !== undefined)), 0)} unit="ms" {...deltaLabel(days, "hrv")} />
        <StatTile label="Resting HR (90d avg)" value={fmt(mean(last90.map((d) => d.rhr).filter((v): v is number => v !== undefined)), 0)} unit="bpm" {...deltaLabel(days, "rhr")} />
        <StatTile label="Peak HR (90d)" value={fmt(Math.max(...last90.map((d) => d.maxHr ?? 0)), 0)} unit="bpm" sub="Highest recorded" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>HRV trend</CardTitle>
          <div className="mt-4">
            <TrendChart data={trendData(last90, "hrv")} metric="hrv" height={200} />
          </div>
        </Card>
        <Card>
          <CardTitle>Resting heart rate trend</CardTitle>
          <div className="mt-4">
            <TrendChart data={trendData(last90, "rhr")} metric="rhr" height={200} />
          </div>
        </Card>
      </div>
      {zoneTotals.some((z) => z > 0) && (
        <Card className="mt-3">
          <CardTitle>Heart rate zones · total workout minutes (90d)</CardTitle>
          <div className="mt-4 max-w-xl">
            <ZonesChart zones={zoneTotals} />
          </div>
        </Card>
      )}

      {/* ============ ACTIVITY ============ */}
      <SectionHeading id="activity" title="Activity" subtitle="Strain, movement and training load" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Avg day strain" value={fmt(strainAvg, 1)} {...deltaLabel(days, "strain")} />
        <StatTile label="Avg steps" value={fmt(mean(last90.map((d) => d.steps).filter((v): v is number => v !== undefined)), 0)} {...deltaLabel(days, "steps")} />
        <StatTile label="Avg calories burned" value={fmt(mean(last90.map((d) => d.calories).filter((v): v is number => v !== undefined)), 0)} unit="kcal" />
        <StatTile
          label="Load ratio (7d : 28d)"
          value={isFinite(acr) ? fmt(acr, 2) : "–"}
          sub={isFinite(acr) ? (acr > 1.3 ? "Ramping fast — injury-risk zone" : acr < 0.8 ? "Deloading" : "Balanced load") : undefined}
        />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Strain trend · 90 days</CardTitle>
          <div className="mt-4">
            <TrendChart data={trendData(last90, "strain")} metric="strain" height={200} />
          </div>
        </Card>
        <Card>
          <CardTitle>Workouts (90d)</CardTitle>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-semibold">{workouts.length}</span>
              <span className="text-xs text-base-400">{fmt(workouts.length / (last90.length / 7), 1)} per week</span>
            </div>
            {topSports.map(([sport, count]) => (
              <div key={sport} className="flex items-center gap-3">
                <span className="w-24 truncate text-xs text-base-300">{sport}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-series-orange" style={{ width: `${(count / topSports[0][1]) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs tabular text-base-400">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ============ LIFESTYLE ============ */}
      {lifestyleAvailable.length > 0 && (
        <>
          <SectionHeading id="lifestyle" title="Lifestyle" subtitle="Logged behaviors that move the needle" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lifestyleAvailable.map((k) => {
              const meta = METRICS[k];
              const vals = last90.map((d) => val(d, k)).filter((v): v is number => v !== undefined);
              return (
                <StatTile
                  key={k}
                  label={meta.label}
                  value={fmt(mean(vals), meta.decimals)}
                  unit={meta.unit}
                  sub={`${vals.length} days logged`}
                  {...deltaLabel(days, k)}
                />
              );
            })}
          </div>
          {last90.some((d) => d.alcoholDrinks !== undefined) && (
            <Card className="mt-3">
              <CardTitle>Recovery by weekday</CardTitle>
              <div className="mt-4 max-w-2xl">
                <CompareBars
                  groups={weekdayGroups(last90)}
                  metric="recovery"
                  height={190}
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function deltaLabel(days: DayRecord[], k: MetricKey) {
  const { delta, good } = deltaVsPrior(days, k);
  return delta ? { delta: `${delta} / 30d`, deltaGood: good } : {};
}

function weekdayGroups(days: DayRecord[]) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDow: number[][] = [[], [], [], [], [], [], []];
  for (const d of days) if (d.recovery !== undefined) byDow[new Date(d.date + "T12:00:00").getDay()].push(d.recovery);
  return [1, 2, 3, 4, 5, 6, 0].map((i) => ({ label: names[i], value: byDow[i].length ? mean(byDow[i]) : 0, n: byDow[i].length }));
}

function DayList({ days }: { days: DayRecord[] }) {
  return (
    <div className="mt-3 space-y-1.5">
      {days.map((d) => (
        <Link
          key={d.date}
          href={`/timeline?date=${d.date}`}
          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/[0.04]"
        >
          <span className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full" style={{ background: recoveryColor(d.recovery) }} />
            <span className="text-base-200">{formatDate(d.date, { weekday: "short", month: "short", day: "numeric" })}</span>
          </span>
          <span className="flex items-center gap-3 tabular text-xs text-base-400">
            <span>{d.sleepHours !== undefined ? `${fmt(d.sleepHours, 1)}h sleep` : ""}</span>
            <span className="font-semibold text-white">{d.recovery}%</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={null}>
        <DemoLoader />
      </Suspense>
      <RequireData>
        <Dashboard />
      </RequireData>
    </>
  );
}
