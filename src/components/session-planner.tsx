"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { estimateActivityLoad } from "@/lib/scoring/strain";
import type { StrainTarget } from "@/lib/scoring/strain-target";
import { DOMAIN_COLOR, cn } from "@/lib/format";

/**
 * "If I did this, where would I land?" — pick an intensity and duration and see
 * the session's projected strain added to today's, checked against the target
 * range. Uses the SAME load estimate the app applies when a workout is logged,
 * so the projection matches reality.
 */

const INTENSITIES: { key: string; label: string; hr: number; hint: string }[] = [
  { key: "easy", label: "Easy", hr: 115, hint: "walk, mobility, zone-1" },
  { key: "moderate", label: "Moderate", hr: 140, hint: "zone-2, steady cardio" },
  { key: "hard", label: "Hard", hr: 162, hint: "tempo, strength, sport" },
  { key: "allout", label: "All-out", hr: 178, hint: "intervals, race pace" },
];

export function SessionPlanner({ current, target }: { current: number; target: StrainTarget }) {
  const [intensity, setIntensity] = useState(INTENSITIES[1]);
  const [minutes, setMinutes] = useState(45);
  const col = DOMAIN_COLOR.strain;

  const added = estimateActivityLoad(minutes, intensity.hr);
  const projected = Math.min(21, Math.round((current + added) * 10) / 10);
  const verdict =
    projected < target.low ? { text: "below your target — room for more", c: "#eb9d18" }
    : projected <= target.high ? { text: "right in your target zone", c: "#13b57e" }
    : { text: "over your target — that's a big day", c: "#ef5a45" };

  const barMax = Math.max(21, target.high + 3);
  const pct = (v: number) => `${Math.min(100, (v / barMax) * 100)}%`;

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Plan a session</div>
      <p className="mt-1 text-[11px] text-ink-400">See where a workout would land you before you do it.</p>

      {/* Intensity */}
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {INTENSITIES.map((i) => (
          <button
            key={i.key}
            onClick={() => setIntensity(i)}
            className={cn("rounded-lg px-1 py-1.5 text-[11px] font-semibold transition", intensity.key === i.key ? "text-white" : "border border-black/[0.1] text-ink-300 hover:bg-black/[0.04]")}
            style={intensity.key === i.key ? { background: col } : undefined}
          >
            {i.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-ink-500">{intensity.hint} · ~{intensity.hr} bpm</p>

      {/* Duration */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Duration</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setMinutes((m) => Math.max(10, m - 10))} className="flex h-7 w-7 items-center justify-center rounded-full border border-black/[0.1] text-ink-300 hover:bg-black/[0.04]" aria-label="Less"><Minus size={13} /></button>
          <span className="tabular w-16 text-center text-sm font-semibold text-ink-50">{minutes} min</span>
          <button onClick={() => setMinutes((m) => Math.min(180, m + 10))} className="flex h-7 w-7 items-center justify-center rounded-full border border-black/[0.1] text-ink-300 hover:bg-black/[0.04]" aria-label="More"><Plus size={13} /></button>
        </div>
      </div>

      {/* Projection bar with the target zone shaded */}
      <div className="mt-4">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
          {/* target zone */}
          <div className="absolute inset-y-0 rounded-full bg-recovery/25" style={{ left: pct(target.low), width: `calc(${pct(target.high)} - ${pct(target.low)})` }} />
          {/* current strain */}
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(current), background: `${col}66` }} />
          {/* projected total */}
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(projected), background: col, opacity: 0.9 }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-ink-500">
          <span>now {current.toFixed(1)}</span>
          <span className="text-recovery">target {target.low.toFixed(1)}–{target.high.toFixed(1)}</span>
          <span>21</span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2 rounded-xl bg-black/[0.03] px-3.5 py-3">
        <span className="text-xs text-ink-400">This session adds</span>
        <span className="tabular text-lg font-bold" style={{ color: col }}>+{added.toFixed(1)}</span>
        <span className="text-xs text-ink-400">→ day total</span>
        <span className="tabular text-lg font-bold text-ink-50">{projected.toFixed(1)}</span>
        <span className="ml-auto text-right text-[11px] font-medium" style={{ color: verdict.c }}>{verdict.text}</span>
      </div>
    </div>
  );
}
