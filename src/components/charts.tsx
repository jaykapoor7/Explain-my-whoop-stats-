"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "@/lib/utils";
import { METRICS, MetricKey, ChartPoint } from "@/lib/types";
import { fmt } from "@/lib/stats";

/* Shared dark chart chrome (validated palette: grid #2a2f63, muted ink #8b91c7). */

const AXIS = { stroke: "#3a4080", tick: { fill: "#8b91c7", fontSize: 11 }, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "#2a2f63", strokeDasharray: "0", vertical: false } as const;

function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  labelFormatter?: (l: string | number, payload?: { payload?: Record<string, unknown> }[]) => string;
  valueFormatter?: (v: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-white">
        {labelFormatter ? labelFormatter(label ?? "", payload) : label}
      </div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-base-200">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? "#4d9fff" }} />
          <span>
            {valueFormatter && typeof p.value === "number" ? valueFormatter(p.value, p.name) : `${p.name}: ${p.value}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({
  data,
  metric,
  height = 220,
  showAverage = true,
  color,
}: {
  data: { date: string; value: number | null; avg?: number | null }[];
  metric: MetricKey;
  height?: number;
  showAverage?: boolean;
  color?: string;
}) {
  const meta = METRICS[metric];
  const c = color ?? meta.color;
  const gradId = `grad-${metric}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={0.28} />
            <stop offset="100%" stopColor={c} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => formatDate(d)} minTickGap={42} />
        <YAxis {...AXIS} width={46} domain={["auto", "auto"]} tickFormatter={(v) => fmt(v, 0)} />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(l) => formatDate(String(l), { weekday: "short", month: "short", day: "numeric" })}
              valueFormatter={(v, name) => `${name === "7-day avg" ? "7-day avg: " : `${meta.shortLabel}: `}${fmt(v, meta.decimals)}${meta.unit}`}
            />
          }
          cursor={{ stroke: "#3a4080" }}
        />
        <Area type="monotone" dataKey="value" name={meta.shortLabel} stroke={c} strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls />
        {showAverage && (
          <Line type="monotone" dataKey="avg" name="7-day avg" stroke="#b9befa" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CorrelationScatter({
  points,
  xKey,
  yKey,
  trend,
  height = 300,
}: {
  points: ChartPoint[];
  xKey: MetricKey;
  yKey: MetricKey;
  trend?: { slope: number; intercept: number };
  height?: number;
}) {
  const xMeta = METRICS[xKey];
  const yMeta = METRICS[yKey];
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const trendData = trend
    ? [
        { x: minX, y: trend.intercept + trend.slope * minX },
        { x: maxX, y: trend.intercept + trend.slope * maxX },
      ]
    : [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
        <CartesianGrid {...GRID} vertical />
        <XAxis
          dataKey="x"
          type="number"
          name={xMeta.shortLabel}
          domain={["auto", "auto"]}
          {...AXIS}
          tickFormatter={(v) => fmt(v, xMeta.decimals > 0 ? 1 : 0)}
          label={{ value: `${xMeta.label}${xMeta.unit ? ` (${xMeta.unit})` : ""}`, position: "insideBottom", offset: -2, fill: "#8b91c7", fontSize: 11 }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name={yMeta.shortLabel}
          domain={["auto", "auto"]}
          {...AXIS}
          width={50}
          tickFormatter={(v) => fmt(v, 0)}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as ChartPoint | undefined;
                return p ? formatDate(p.date, { weekday: "short", month: "short", day: "numeric" }) : "";
              }}
              valueFormatter={(v, name) =>
                name === xMeta.shortLabel
                  ? `${xMeta.shortLabel}: ${fmt(v, xMeta.decimals)}${xMeta.unit}`
                  : `${yMeta.shortLabel}: ${fmt(v, yMeta.decimals)}${yMeta.unit}`
              }
            />
          }
          cursor={{ stroke: "#3a4080" }}
        />
        <Scatter data={points} fill="#4d9fff" fillOpacity={0.75} shape="circle" isAnimationActive={false} />
        {trend && (
          <Scatter
            data={trendData}
            line={{ stroke: "#b9befa", strokeWidth: 1.5, strokeDasharray: "6 4" }}
            shape={() => <g />}
            isAnimationActive={false}
          />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function CompareBars({
  groups,
  metric,
  height = 220,
}: {
  groups: { label: string; value: number; n: number }[];
  metric: MetricKey;
  height?: number;
}) {
  const meta = METRICS[metric];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={groups} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} barCategoryGap="32%">
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} interval={0} tick={{ fill: "#8b91c7", fontSize: 11 }} />
        <YAxis {...AXIS} width={46} tickFormatter={(v) => fmt(v, 0)} />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(l, payload) => {
                const p = payload?.[0]?.payload as { n?: number } | undefined;
                return `${l}${p?.n ? ` · ${p.n} days` : ""}`;
              }}
              valueFormatter={(v) => `${meta.shortLabel}: ${fmt(v, meta.decimals)}${meta.unit}`}
            />
          }
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="value" name={meta.shortLabel} radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          {groups.map((_, i) => (
            <Cell key={i} fill={i === 0 ? meta.color : "#4a5090"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DistributionChart({
  values,
  metric,
  bins = 12,
  height = 200,
}: {
  values: number[];
  metric: MetricKey;
  bins?: number;
  height?: number;
}) {
  const meta = METRICS[metric];
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const data = Array.from({ length: bins }, (_, i) => {
    const lo = min + i * width;
    const hi = lo + width;
    return {
      label: `${fmt(lo, 0)}–${fmt(hi, 0)}`,
      mid: (lo + hi) / 2,
      count: values.filter((v) => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length,
    };
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap={2}>
        <XAxis dataKey="label" {...AXIS} interval={Math.ceil(bins / 6) - 1} />
        <YAxis {...AXIS} width={40} allowDecimals={false} />
        <Tooltip
          content={<ChartTooltip valueFormatter={(v) => `${v} days`} />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="count" name="Days" fill={meta.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SleepStagesChart({
  data,
  height = 240,
}: {
  data: { date: string; deep?: number; rem?: number; light?: number; awake?: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} barCategoryGap={1}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => formatDate(d)} minTickGap={42} />
        <YAxis {...AXIS} width={40} tickFormatter={(v) => `${v}h`} />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(l) => formatDate(String(l), { weekday: "short", month: "short", day: "numeric" })}
              valueFormatter={(v, name) => `${name}: ${fmt(v, 1)}h`}
            />
          }
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="deep" name="Deep" stackId="s" fill="#3b82f6" isAnimationActive={false} />
        <Bar dataKey="rem" name="REM" stackId="s" fill="#a78bfa" isAnimationActive={false} />
        <Bar dataKey="light" name="Light" stackId="s" fill="#7cc4ff" isAnimationActive={false} />
        <Bar dataKey="awake" name="Awake" stackId="s" fill="#4a5090" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ZonesChart({ zones, height = 180 }: { zones: number[]; height?: number }) {
  const colors = ["#7cc4ff", "#34d399", "#fbbf24", "#fb8a67", "#fb7185"];
  const data = zones.map((min, i) => ({ label: `Zone ${i + 1}`, minutes: min }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: -6, bottom: 0 }} barCategoryGap="28%">
        <XAxis type="number" {...AXIS} tickFormatter={(v) => `${v}m`} />
        <YAxis type="category" dataKey="label" {...AXIS} width={58} />
        <Tooltip
          content={<ChartTooltip valueFormatter={(v) => `${fmt(v, 0)} min`} />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar dataKey="minutes" name="Time" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniSpark({ data, color, height = 44 }: { data: { value: number | null }[]; color: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export { ReferenceLine };
