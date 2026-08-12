"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { cn, fmtDate, relativeDay } from "@/lib/format";

/** WHOOP-style day navigator: step through synced days to see that day's stats. */
export function DaySwitcher({ className }: { className?: string }) {
  const { days, viewDate, isLatest } = useHealth();
  const setSelectedDate = useApp((s) => s.setSelectedDate);
  if (days.length < 2 || !viewDate) return null;

  const idx = days.findIndex((d) => d.day.date === viewDate);
  const latestDate = days[days.length - 1].day.date;
  const go = (delta: number) => {
    const target = days[idx + delta];
    if (!target) return;
    setSelectedDate(target.day.date === latestDate ? null : target.day.date);
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-ink-900 p-1 shadow-[0_1px_2px_-1px_rgba(59,46,20,0.12)]">
        <button
          onClick={() => go(-1)}
          disabled={idx <= 0}
          aria-label="Previous day"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors enabled:hover:bg-black/[0.05] enabled:hover:text-ink-100 disabled:opacity-30"
        >
          <ChevronLeft size={17} />
        </button>
        <div className="min-w-[120px] px-1 text-center">
          <div className="font-display text-sm font-semibold leading-tight text-ink-50">{relativeDay(viewDate)}</div>
          <div className="text-[10px] leading-tight text-ink-400">{fmtDate(viewDate, { weekday: "short", month: "short", day: "numeric" })}</div>
        </div>
        <button
          onClick={() => go(1)}
          disabled={idx >= days.length - 1}
          aria-label="Next day"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors enabled:hover:bg-black/[0.05] enabled:hover:text-ink-100 disabled:opacity-30"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      {!isLatest && (
        <button
          onClick={() => setSelectedDate(null)}
          className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-ink-900 px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-black/[0.04] hover:text-ink-100"
        >
          <RotateCcw size={12} /> Latest
        </button>
      )}
    </div>
  );
}
