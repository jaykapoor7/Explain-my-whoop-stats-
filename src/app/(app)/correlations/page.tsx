"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useApp } from "@/lib/store";
import { RequireData } from "@/components/require-data";
import { Badge, Card, FadeIn } from "@/components/ui";
import { CorrelationScatter } from "@/components/charts";
import { ChartPoint, DayRecord, METRIC_LIST, METRICS, MetricKey } from "@/lib/types";
import { fmt, linearRegression, pearson, pearsonP } from "@/lib/stats";
import { cn } from "@/lib/utils";

/** Curated pairs shown as quick-select chips; any pair is selectable below. */
const FEATURED: { x: MetricKey; y: MetricKey; lag: number; label: string }[] = [
  { x: "sleepHours", y: "hrv", lag: 0, label: "Sleep vs HRV" },
  { x: "sleepHours", y: "recovery", lag: 0, label: "Sleep vs Recovery" },
  { x: "proteinG", y: "recovery", lag: 1, label: "Protein vs Recovery" },
  { x: "calorieIntake", y: "sleepHours", lag: 1, label: "Calories vs Sleep" },
  { x: "alcoholDrinks", y: "hrv", lag: 1, label: "Alcohol vs HRV" },
  { x: "strain", y: "recovery", lag: 1, label: "Training Load vs Recovery" },
  { x: "stress", y: "sleepEfficiency", lag: 0, label: "Stress vs Sleep" },
  { x: "mood", y: "sleepHours", lag: 0, label: "Mood vs Sleep" },
  { x: "bedtimeHour", y: "sleepEfficiency", lag: 0, label: "Bedtime vs Efficiency" },
  { x: "caffeineMg", y: "sleepEfficiency", lag: 1, label: "Caffeine vs Sleep" },
];

const val = (d: DayRecord, k: MetricKey) => d[k] as number | undefined;

function pairData(days: DayRecord[], x: MetricKey, y: MetricKey, lag: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  const points: ChartPoint[] = [];
  for (let i = 0; i < days.length - lag; i++) {
    const xv = val(days[i], x);
    const yv = val(days[i + lag], y);
    if (xv === undefined || yv === undefined) continue;
    xs.push(xv);
    ys.push(yv);
    points.push({ x: xv, y: yv, date: days[i + lag].date });
  }
  return { xs, ys, points };
}

function strengthLabel(r: number, p: number): { label: string; tone: "good" | "warning" | "neutral" } {
  const abs = Math.abs(r);
  if (p < 0.01 && abs >= 0.5) return { label: "Strong", tone: "good" };
  if (p < 0.05 && abs >= 0.3) return { label: "Moderate", tone: "warning" };
  if (abs >= 0.15) return { label: "Weak", tone: "neutral" };
  return { label: "None detected", tone: "neutral" };
}

function interpret(x: MetricKey, y: MetricKey, r: number, p: number, slope: number, n: number, lag: number): string {
  const xm = METRICS[x];
  const ym = METRICS[y];
  const abs = Math.abs(r);
  if (n < 10) return "Not enough overlapping days with both metrics logged to say anything meaningful yet.";
  if (abs < 0.15 || p > 0.1)
    return `Across ${n} days there's no meaningful relationship between ${xm.label.toLowerCase()} and ${ym.label.toLowerCase()}${lag ? " the next day" : ""}. That's a finding too — this pair doesn't move together in your data.`;
  const dir = r > 0 ? "higher" : "lower";
  const strength = abs >= 0.5 ? "a strong" : abs >= 0.3 ? "a moderate" : "a weak";
  return `Your data shows ${strength} ${r > 0 ? "positive" : "negative"} relationship: days with more ${xm.label.toLowerCase()} tend to come with ${dir} ${ym.label.toLowerCase()}${lag ? " the following day" : ""} — roughly ${slope > 0 ? "+" : ""}${fmt(slope, 2)}${ym.unit} per ${xm.unit || "unit"}. ${p < 0.01 ? "The pattern is unlikely to be chance" : "It could still partly be chance"} (p ≈ ${p < 0.001 ? "<0.001" : fmt(p, 3)}), and correlation alone can't tell you which direction the causation runs — or whether a third factor drives both.`;
}

function CorrelationsBody() {
  const days = useApp((s) => s.days);
  const [xKey, setXKey] = useState<MetricKey>("sleepHours");
  const [yKey, setYKey] = useState<MetricKey>("hrv");
  const [lag, setLag] = useState(0);

  const available = useMemo(
    () => METRIC_LIST.filter((m) => days.some((d) => val(d, m.key) !== undefined)),
    [days]
  );

  const { xs, ys, points } = useMemo(() => pairData(days, xKey, yKey, lag), [days, xKey, yKey, lag]);
  const r = pearson(xs, ys);
  const p = pearsonP(r, xs.length);
  const reg = xs.length >= 3 ? linearRegression(xs, ys) : null;
  const strength = strengthLabel(isFinite(r) ? r : 0, p);

  const featuredAvailable = FEATURED.filter(
    (f) => available.some((m) => m.key === f.x) && available.some((m) => m.key === f.y)
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Correlation Explorer</h1>
      <p className="mt-1 text-sm text-base-400">
        Pick any two variables and see how they move together in your data — scatter, trend line, and an honest read.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {featuredAvailable.map((f) => {
          const active = f.x === xKey && f.y === yKey && f.lag === lag;
          return (
            <button
              key={f.label}
              onClick={() => {
                setXKey(f.x);
                setYKey(f.y);
                setLag(f.lag);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                active ? "bg-white text-base-950" : "border border-white/10 text-base-300 hover:bg-white/[0.06]"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <FadeIn className="mt-5">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Select label="X" value={xKey} onChange={setXKey} options={available.map((m) => [m.key, m.label])} />
            <button
              onClick={() => {
                setXKey(yKey);
                setYKey(xKey);
              }}
              className="mt-5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-base-300 transition hover:bg-white/[0.06]"
              aria-label="Swap axes"
            >
              <ArrowLeftRight size={14} />
            </button>
            <Select label="Y" value={yKey} onChange={setYKey} options={available.map((m) => [m.key, m.label])} />
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-base-400">Timing</label>
              <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs">
                {[
                  [0, "Same day"],
                  [1, "Next day"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setLag(v as number)}
                    className={cn("px-3 py-2 font-medium transition", lag === v ? "bg-white/10 text-white" : "text-base-400 hover:text-base-200")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge tone={strength.tone}>{strength.label}</Badge>
              <span className="text-xs tabular text-base-400">
                r = {isFinite(r) ? fmt(r, 2) : "–"} · n = {xs.length} · p ≈ {isFinite(r) ? (p < 0.001 ? "<0.001" : fmt(p, 3)) : "–"}
              </span>
            </div>
          </div>

          <div className="mt-6">
            {points.length >= 5 ? (
              <CorrelationScatter
                points={points}
                xKey={xKey}
                yKey={yKey}
                trend={reg && Math.abs(r) >= 0.15 && isFinite(reg.slope) ? { slope: reg.slope, intercept: reg.intercept } : undefined}
                height={340}
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-base-400">
                Fewer than 5 days have both metrics logged — not enough to plot.
              </div>
            )}
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={0.08}>
        <Card className="mt-3">
          <h3 className="text-sm font-medium text-base-200">Interpretation</h3>
          <p className="mt-2 text-sm leading-relaxed text-base-300">
            {interpret(xKey, yKey, isFinite(r) ? r : 0, p, reg?.slope ?? 0, xs.length, lag)}
          </p>
        </Card>
      </FadeIn>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-base-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 rounded-lg border border-white/10 bg-base-850 px-3 text-sm text-white outline-none transition focus:border-accent/60"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CorrelationsPage() {
  return (
    <RequireData>
      <CorrelationsBody />
    </RequireData>
  );
}
