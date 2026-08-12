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
import { fmtDate, fmtNum, fmtTime } from "@/lib/format";

const AXIS = { stroke: "#dcd2be", tick: { fill: "#83765f", fontSize: 11 }, tickLine: false, axisLine: false } as const;
const GRID = { stroke: "#e7dfce", vertical: false } as const;

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
      <AreaChart data={data} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => fmtDate(String(d))} minTickGap={44} />
        <YAxis {...AXIS} width={44} domain={domain ?? ["auto", "auto"]} tickFormatter={(v) => fmtNum(v)} />
        <Tooltip content={<Tip unit={unit} name={name} />} cursor={{ stroke: color, strokeOpacity: 0.35, strokeWidth: 1.5 }} />
        {baseline !== undefined && (
          <ReferenceLine y={baseline} stroke="#a4977f" strokeDasharray="5 4" strokeWidth={1.25} />
        )}
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${id})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fdfaf3" }}
          connectNulls
          style={{ filter: `drop-shadow(0 4px 8px ${color}33)` }}
        />
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

const STAGE_COLORS: Record<string, string> = { deep: "#4b3f9e", light: "#7b68ee", rem: "#2298cf", awake: "#d98324" };

/** WHOOP-style hypnogram: stage depth over the night. */
export function Hypnogram({ segments, bedtime, wake }: { segments: { start: string; end: string; stage: string }[]; bedtime: string; wake: string }) {
  // Anchor the timeline to the actual segment span so it's robust to bad bounds.
  const times = segments.flatMap((s) => [Date.parse(s.start), Date.parse(s.end)]).filter((n) => isFinite(n));
  const startMs = Math.min(Date.parse(bedtime), ...times);
  const endMs = Math.max(Date.parse(wake), ...times);
  if (!(endMs > startMs)) return null;
  const dur = endMs - startMs;
  const LANES = ["awake", "rem", "light", "deep"] as const;
  const laneLabel: Record<string, string> = { awake: "Awake", rem: "REM", light: "Light", deep: "Deep" };
  const laneH = 24;
  const gap = 6;
  const height = LANES.length * laneH + (LANES.length - 1) * gap;
  return (
    <div>
      <div className="flex gap-2.5">
        <div className="flex w-9 shrink-0 flex-col" style={{ height }}>
          {LANES.map((lane, i) => (
            <div key={lane} className="flex items-center" style={{ height: laneH, marginTop: i ? gap : 0 }}>
              <span className="text-[9px] font-medium uppercase tracking-wide text-ink-500">{laneLabel[lane]}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {LANES.map((lane, i) => (
            <div key={lane} className="absolute inset-x-0 rounded-md bg-black/[0.035]" style={{ top: i * (laneH + gap), height: laneH }} />
          ))}
          {segments.map((seg, i) => {
            const laneIdx = LANES.indexOf(seg.stage as (typeof LANES)[number]);
            if (laneIdx < 0) return null;
            const x = ((Date.parse(seg.start) - startMs) / dur) * 100;
            const w = ((Date.parse(seg.end) - Date.parse(seg.start)) / dur) * 100;
            return (
              <div
                key={i}
                className="absolute rounded-[3px]"
                style={{ left: `${x}%`, width: `calc(max(2px, ${w}%))`, top: laneIdx * (laneH + gap) + 4, height: laneH - 8, background: STAGE_COLORS[seg.stage] }}
              />
            );
          })}
        </div>
      </div>
      <div className="ml-[46px] mt-1.5 flex justify-between text-[10px] tabular text-ink-500">
        <span>{fmtTime(bedtime.slice(11, 16))}</span>
        <span>{fmtTime(wake.slice(11, 16))}</span>
      </div>
    </div>
  );
}

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

const ZONE_COLORS = ["#a4977f", "#2298cf", "#13b57e", "#eb9d18", "#ef5a45"];

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

/** WHOOP-style strain curve: cumulative load climbing through the day. */
export function StrainCurve({ activities, color }: { activities: { start: string; load: number; type: string }[]; color: string }) {
  const hourly = new Array(25).fill(0);
  for (const a of activities) {
    const h = Math.min(24, Math.max(0, parseInt(a.start.slice(11, 13), 10) || 0));
    hourly[h] += a.load;
  }
  let cum = 0;
  const data = hourly.map((v, h) => {
    cum += v;
    return { label: `${String(h % 24).padStart(2, "0")}:00`, value: Math.round(cum * 10) / 10 };
  });
  const gid = `strain-${color.replace(/[^a-z0-9]/gi, "")}`;
  const peak = data[data.length - 1]?.value ?? 0;
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 10, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval={5} minTickGap={16} />
          <YAxis {...AXIS} width={30} domain={[0, (m: number) => Math.max(21, Math.ceil(m))]} allowDecimals={false} />
          <Tooltip content={<Tip unit="" name="Cumulative strain" />} cursor={{ stroke: color, strokeOpacity: 0.3 }} />
          {peak > 0 && <ReferenceLine y={peak} stroke={color} strokeDasharray="4 4" strokeOpacity={0.4} />}
          <Area
            type="stepAfter"
            dataKey="value"
            stroke={color}
            strokeWidth={3.5}
            fill={`url(#${gid})`}
            isAnimationActive={false}
            dot={false}
            style={{ filter: `drop-shadow(0 3px 6px ${color}44)` }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
