"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Moon, Sparkles, UtensilsCrossed } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHealthData } from "@/lib/use-data";
import { RequireData } from "@/components/require-data";
import { Badge, Card, CardTitle, FadeIn, RingGauge } from "@/components/ui";
import { TrendChart } from "@/components/charts";
import { DayRecord, MetricKey } from "@/lib/types";
import { fmt, mean, rollingMean } from "@/lib/stats";
import { generateInsights } from "@/lib/insights";
import { sumEntries, todayKey } from "@/lib/nutrition/nutrition";
import { formatDate, recoveryColor } from "@/lib/utils";

const val = (d: DayRecord, k: MetricKey) => d[k] as number | undefined;
const series = (days: DayRecord[], k: MetricKey) =>
  days.map((d) => val(d, k)).filter((v): v is number => v !== undefined);

function trendData(days: DayRecord[], k: MetricKey) {
  const values = days.map((d) => val(d, k));
  const avg = rollingMean(values, 7);
  return days.map((d, i) => ({ date: d.date, value: values[i] ?? null, avg: avg[i] }));
}

const CONF_TONE = { high: "good", moderate: "warning", exploratory: "neutral" } as const;

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

function Understand() {
  const { days } = useHealthData();
  const foodLog = useApp((s) => s.foodLog);
  const nutritionGoals = useApp((s) => s.nutritionGoals);
  const insights = useMemo(() => generateInsights(days).slice(0, 3), [days]);

  const today = days[days.length - 1];
  const last30 = days.slice(-30);
  const caloriesToday = Math.round(sumEntries(foodLog.filter((e) => e.date === todayKey())).calories);

  const recAvg = mean(series(last30, "recovery"));
  const sleepLast = [...days].reverse().find((d) => d.sleepHours !== undefined)?.sleepHours;

  return (
    <div>
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Understand your data</h1>
        <p className="mt-1 text-sm text-base-400">
          The short version of what your body is doing — and why. {formatDate(today.date, { weekday: "long", month: "long", day: "numeric" })}.
        </p>
      </FadeIn>

      {/* Today, at a glance — just three things */}
      <FadeIn className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-4">
            <RingGauge
              value={today.recovery ?? 0}
              size={92}
              display={today.recovery !== undefined ? String(today.recovery) : "–"}
              color={today.recovery === undefined ? undefined : recoveryColor(today.recovery)}
            />
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-base-400">Recovery</div>
              <div className="mt-0.5 text-sm font-semibold" style={{ color: recoveryColor(today.recovery) }}>
                {today.recovery === undefined ? "No score" : today.recovery >= 67 ? "Ready to push" : today.recovery >= 34 ? "Take it steady" : "Prioritize rest"}
              </div>
              <div className="mt-0.5 text-xs text-base-400">30-day avg {fmt(recAvg, 0)}%</div>
            </div>
          </Card>

          <Card className="flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-base-400">
              <Moon size={13} /> Last night&apos;s sleep
            </div>
            <div className="mt-1 text-3xl font-semibold tabular">
              {sleepLast !== undefined ? fmt(sleepLast, 1) : "–"}
              <span className="text-base text-base-400"> h</span>
            </div>
            <div className="mt-0.5 text-xs text-base-400">
              {today.sleepEfficiency !== undefined ? `${today.sleepEfficiency}% efficiency` : " "}
            </div>
          </Card>

          <Link href="/nutrition" className="group">
            <Card className="card-hover flex h-full flex-col justify-center">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-base-400">
                <UtensilsCrossed size={13} /> Calories today
              </div>
              <div className="mt-1 text-3xl font-semibold tabular">
                {caloriesToday.toLocaleString()}
                <span className="text-base text-base-400"> / {nutritionGoals.calories.toLocaleString()}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-accent-soft">
                Log food <ArrowRight size={11} className="transition group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>
        </div>
      </FadeIn>

      {/* What's going on — plain-English insights */}
      <FadeIn className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles size={17} className="text-vivid-cyan" /> What&apos;s going on
          </h2>
          <Link href="/correlations" className="text-sm font-medium text-accent-soft hover:underline">
            Explore correlations →
          </Link>
        </div>
        {insights.length ? (
          <div className="space-y-2.5">
            {insights.map((ins) => (
              <Card key={ins.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent-soft">
                  <Sparkles size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{ins.headline}</p>
                  <p className="mt-1 text-xs text-base-400">{ins.evidence[0]}</p>
                </div>
                <Badge tone={CONF_TONE[ins.confidence]} className="shrink-0 capitalize">
                  {ins.confidence}
                </Badge>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-sm text-base-400">
            Keep logging — once there&apos;s a couple of weeks of data, the meaningful patterns show up here automatically.
          </Card>
        )}
      </FadeIn>

      {/* Two trends that matter */}
      <FadeIn className="mt-8">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardTitle>Recovery · last 30 days</CardTitle>
            <div className="mt-4">
              <TrendChart data={trendData(last30, "recovery")} metric="recovery" height={190} />
            </div>
          </Card>
          <Card>
            <CardTitle>Sleep · last 30 days</CardTitle>
            <div className="mt-4">
              <TrendChart data={trendData(last30, "sleepHours")} metric="sleepHours" height={190} />
            </div>
          </Card>
        </div>
      </FadeIn>

      <p className="mt-8 text-center text-xs text-base-400">
        Want more depth? <Link href="/correlations" className="text-accent-soft hover:underline">Correlations</Link>,{" "}
        <Link href="/goals" className="text-accent-soft hover:underline">Goals</Link>, and the deeper tools live in the sidebar.
      </p>
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
        <Understand />
      </RequireData>
    </>
  );
}
