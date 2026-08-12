"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtDate, fmtNum } from "@/lib/format";

const AXIS = { stroke: "#333a47", tick: { fill: "#6b7482", fontSize: 11 }, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "#1e232c", vertical: false } as const;

function Tip({ active, payload, label, unit, name }: { active?: boolean; payload?: { value?: number | string }[]; label?: string | number; unit?: string; name?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div className="rounded-lg border border-black/10 bg-ink-800/95 px-3 py-2 text-xs shadow-lift backdrop-blur">
      <div className="font-medium text-ink-50">{typeof label === "string" && label.includes("-") ? fmtDate(label, { weekday: "short", month: "short", day: "numeric" }) : label}</div>
      <div className="mt-0.5 text-ink-300">
        {name ? `${name}: ` : ""}
        {typeof v === "number" ? fmtNum(v, v % 1 ? 1 : 0) : v}
        {unit}
      </div>
    </div>
  );
}

export function TrendArea({
  data,
  color,
  unit = "",
  name,
  height = 200,
  baseline,
  domain,
}: {
  data: { date: string; value: number | null }[];
  color: string;
  unit?: string;
  name?: string;
  height?: number;
  baseline?: number;
  domain?: [number | "auto", number | "auto"];
}) {
  const id = `g-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => fmtDate(String(d))} minTickGap={44} />
        <YAxis {...AXIS} width={44} domain={domain ?? ["auto", "auto"]} tickFormatter={(v) => fmtNum(v)} />
        <Tooltip content={<Tip unit={unit} name={name} />} cursor={{ stroke: "#333a47" }} />
        {baseline !== undefined && (
          <ReferenceLine y={baseline} stroke="#4a5361" strokeDasharray="5 4" strokeWidth={1} />
        )}
        <Area type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 3.5, strokeWidth: 0 }} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MiniBars({
  data,
  color,
  unit = "",
  height = 170,
  name,
}: {
  data: { label: string; value: number }[];
  color: string;
  unit?: string;
  height?: number;
  name?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={42} tickFormatter={(v) => fmtNum(v)} />
        <Tooltip content={<Tip unit={unit} name={name} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="value" name={name} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const STAGE_COLORS: Record<string, string> = { deep: "#5f60d8", rem: "#8b8cff", light: "#b6b7ff", awake: "#4a5361" };

export function SleepStagesBar({ stages }: { stages: Record<string, number> }) {
  const order = ["deep", "rem", "light", "awake"];
  const total = order.reduce((s, k) => s + (stages[k] ?? 0), 0) || 1;
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full">
        {order.map((k) => (
          <div key={k} style={{ width: `${((stages[k] ?? 0) / total) * 100}%`, background: STAGE_COLORS[k] }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400">
        {order.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: STAGE_COLORS[k] }} />
            <span className="capitalize">{k}</span>
            <span className="tabular text-ink-300">{Math.floor((stages[k] ?? 0) / 60)}h {String(Math.round((stages[k] ?? 0) % 60)).padStart(2, "0")}m</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const ZONE_COLORS = ["#4a5361", "#5cc8ff", "#38d39f", "#f6b83b", "#ff7a5c"];

export function ZoneBars({ zones }: { zones: number[] }) {
  const max = Math.max(...zones, 1);
  return (
    <div className="space-y-1.5">
      {zones.map((min, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="w-10 text-[11px] text-ink-400">Z{i + 1}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${(min / max) * 100}%`, background: ZONE_COLORS[i] }} />
          </div>
          <span className="tabular w-10 text-right text-[11px] text-ink-300">{Math.round(min)}m</span>
        </div>
      ))}
    </div>
  );
}
