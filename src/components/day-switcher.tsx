"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { cn, fmtDate, relativeDay } from "@/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** WHOOP-style day navigator with a calendar popover to jump to any synced date. */
export function DaySwitcher({ className }: { className?: string }) {
  const { days, viewDate, isLatest } = useHealth();
  const setSelectedDate = useApp((s) => s.setSelectedDate);
  const [open, setOpen] = useState(false);

  const available = useMemo(() => new Set(days.map((d) => d.day.date)), [days]);
  const [cal, setCal] = useState(() => {
    const base = viewDate ?? days[days.length - 1]?.day.date;
    const [y, m] = (base ?? new Date().toISOString().slice(0, 10)).split("-").map(Number);
    return { y, m: m - 1 };
  });

  if (days.length < 2 || !viewDate) return null;

  const idx = days.findIndex((d) => d.day.date === viewDate);
  const latestDate = days[days.length - 1].day.date;
  const pick = (iso: string) => setSelectedDate(iso === latestDate ? null : iso);
  const go = (delta: number) => {
    const target = days[idx + delta];
    if (target) pick(target.day.date);
  };

  // Month grid cells for the calendar.
  const first = new Date(cal.y, cal.m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${cal.y}-${pad(cal.m + 1)}-${pad(d)}`);

  return (
    <div className={cn("relative flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5 rounded-full border border-black/[0.08] bg-ink-900 p-1 shadow-[0_1px_2px_-1px_rgba(59,46,20,0.12)]">
        <button
          onClick={() => go(-1)}
          disabled={idx <= 0}
          aria-label="Previous day"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors enabled:hover:bg-black/[0.05] enabled:hover:text-ink-100 disabled:opacity-30"
        >
          <ChevronLeft size={17} />
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-[116px] items-center justify-center gap-1.5 rounded-full px-2 py-0.5 transition-colors hover:bg-black/[0.04]"
        >
          <CalendarDays size={13} className="text-ink-400" />
          <span className="text-left">
            <span className="block font-display text-sm font-semibold leading-tight text-ink-50">{relativeDay(viewDate)}</span>
            <span className="block text-[10px] leading-tight text-ink-400">{fmtDate(viewDate, { month: "short", day: "numeric" })}</span>
          </span>
        </button>
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
          className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-black/[0.04] hover:text-ink-100"
        >
          <RotateCcw size={12} /> <span className="hidden sm:inline">Latest</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <button aria-label="Close calendar" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 top-full z-50 mt-2 w-[268px] rounded-2xl border border-black/[0.08] bg-ink-900 p-3 shadow-[0_20px_50px_-24px_rgba(59,46,20,0.5)]"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => setCal((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-black/[0.05] hover:text-ink-100"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-display text-sm font-semibold text-ink-50">
                  {new Date(cal.y, cal.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setCal((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-black/[0.05] hover:text-ink-100"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className="py-1 text-center text-[10px] font-medium text-ink-500">
                    {w}
                  </div>
                ))}
                {cells.map((iso, i) =>
                  iso === null ? (
                    <div key={i} />
                  ) : (
                    <button
                      key={iso}
                      disabled={!available.has(iso)}
                      onClick={() => {
                        pick(iso);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-lg text-xs tabular transition-colors",
                        iso === viewDate
                          ? "bg-recovery font-semibold text-[#241f18]"
                          : available.has(iso)
                            ? "font-medium text-ink-100 hover:bg-black/[0.06]"
                            : "text-ink-500/50"
                      )}
                    >
                      {Number(iso.slice(8))}
                    </button>
                  )
                )}
              </div>
              <p className="mt-2 text-center text-[10px] text-ink-500">Days with synced data are selectable.</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
