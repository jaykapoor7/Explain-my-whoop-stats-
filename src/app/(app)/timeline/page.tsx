"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BedDouble, CalendarDays, Dumbbell, HeartPulse, NotebookPen, Utensils, Zap } from "lucide-react";
import { useHealthData } from "@/lib/use-data";
import { RequireData } from "@/components/require-data";
import { Badge, Card } from "@/components/ui";
import { CalendarEvent, DayRecord } from "@/lib/types";
import { fmt } from "@/lib/stats";
import { cn, formatDateLong, hourLabel, recoveryColor, recoveryLabel } from "@/lib/utils";

/** Git-history-style browser over every logged day. */

function DayDot({ day, selected, onClick }: { day: DayRecord; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${day.date} · ${day.recovery ?? "–"}%`}
      className={cn(
        "h-7 w-7 shrink-0 rounded-md transition-all hover:scale-110",
        selected && "ring-2 ring-white ring-offset-2 ring-offset-base-950"
      )}
      style={{ background: recoveryColor(day.recovery), opacity: day.recovery === undefined ? 0.25 : 0.4 + (day.recovery / 100) * 0.6 }}
    />
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-white/[0.05] py-3 last:border-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-base-300">
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-base-400">{label}</div>
        <div className="mt-0.5 text-sm text-base-100">{children}</div>
      </div>
    </div>
  );
}

const EVENT_COLORS: Record<string, string> = {
  meeting: "#fbbf24",
  social: "#f472b6",
  travel: "#4d9fff",
  workout: "#34d399",
  study: "#a78bfa",
  personal: "#8b91c7",
  vacation: "#7cc4ff",
};

function Schedule({ events }: { events: CalendarEvent[] }) {
  const timed = events.filter((e) => !e.allDay).sort((a, b) => a.startHour - b.startHour);
  const allDay = events.filter((e) => e.allDay);
  return (
    <div className="space-y-1.5">
      {allDay.map((e) => (
        <div key={e.id} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: EVENT_COLORS[e.type] }} />
          <span className="text-base-100">{e.title}</span>
          <span className="text-xs text-base-400">all day</span>
        </div>
      ))}
      {timed.map((e) => (
        <div key={e.id} className="flex items-center gap-2.5 text-sm">
          <span className="w-[4.6rem] shrink-0 text-xs tabular text-base-400">{hourLabel(e.startHour)}</span>
          <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: EVENT_COLORS[e.type] }} />
          <span className="truncate text-base-100">{e.title}</span>
          <span className="shrink-0 text-xs text-base-400">
            {e.durationMin >= 60 ? `${Math.round((e.durationMin / 60) * 10) / 10}h` : `${e.durationMin}m`}
          </span>
          {e.location && <span className="hidden truncate text-xs text-base-400 sm:inline">· {e.location}</span>}
        </div>
      ))}
    </div>
  );
}

function DayDetail({ day, events }: { day: DayRecord; events: CalendarEvent[] }) {
  const tone = day.recovery === undefined ? "neutral" : day.recovery >= 67 ? "good" : day.recovery >= 34 ? "warning" : "critical";
  return (
    <motion.div
      key={day.date}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{formatDateLong(day.date)}</h2>
          <Badge tone={tone}>
            {recoveryLabel(day.recovery)} {day.recovery !== undefined ? `· ${day.recovery}%` : ""}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Recovery", day.recovery !== undefined ? `${day.recovery}%` : "–"],
            ["HRV", day.hrv !== undefined ? `${day.hrv} ms` : "–"],
            ["Resting HR", day.rhr !== undefined ? `${day.rhr} bpm` : "–"],
            ["Strain", day.strain !== undefined ? fmt(day.strain, 1) : "–"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
              <div className="text-[11px] text-base-400">{label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          {events.length > 0 && (
            <Row icon={CalendarDays} label={`Schedule · ${events.length} event${events.length > 1 ? "s" : ""}`}>
              <Schedule events={events} />
              {(day.meetingCount ?? 0) > 0 && (
                <div className="mt-1.5 text-xs text-base-400">
                  {day.meetingCount} meeting{day.meetingCount! > 1 ? "s" : ""} · {day.meetingMinutes} min
                  {(day.backToBackMeetings ?? 0) >= 1 ? ` · ${day.backToBackMeetings} back-to-back` : ""}
                  {day.officeDay === true ? " · in office" : day.officeDay === false ? " · from home" : ""}
                </div>
              )}
            </Row>
          )}
          <Row icon={BedDouble} label="Sleep">
            {day.sleepHours !== undefined ? (
              <>
                {fmt(day.sleepHours, 1)}h asleep
                {day.sleepEfficiency !== undefined && <> · {day.sleepEfficiency}% efficiency</>}
                {day.bedtimeHour !== undefined && <> · {hourLabel(day.bedtimeHour)} → {hourLabel(day.wakeHour)}</>}
                {(day.deepHours !== undefined || day.remHours !== undefined) && (
                  <div className="mt-1 text-xs text-base-400">
                    Deep {fmt(day.deepHours, 1)}h · REM {fmt(day.remHours, 1)}h · Light {fmt(day.lightHours, 1)}h
                    {day.sleepDebtHours !== undefined && <> · debt {fmt(day.sleepDebtHours, 1)}h</>}
                  </div>
                )}
              </>
            ) : (
              <span className="text-base-400">No sleep data</span>
            )}
          </Row>

          <Row icon={Dumbbell} label="Workouts">
            {day.workouts?.length ? (
              <div className="space-y-1">
                {day.workouts.map((w, i) => (
                  <div key={i}>
                    {w.sport} — {w.durationMin} min
                    {w.strain !== undefined && <> · strain {fmt(w.strain, 1)}</>}
                    {w.avgHr !== undefined && <> · avg {w.avgHr} bpm</>}
                    {w.startHour !== undefined && <> · {hourLabel(w.startHour)}</>}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-base-400">Rest day</span>
            )}
          </Row>

          <Row icon={Zap} label="Activity">
            {day.steps !== undefined && <>{day.steps.toLocaleString()} steps</>}
            {day.calories !== undefined && <> · {day.calories.toLocaleString()} kcal burned</>}
            {day.maxHr !== undefined && <> · max HR {day.maxHr} bpm</>}
          </Row>

          {(day.proteinG !== undefined || day.calorieIntake !== undefined || day.alcoholDrinks !== undefined || day.caffeineMg !== undefined) && (
            <Row icon={Utensils} label="Nutrition & intake">
              {day.calorieIntake !== undefined && <>{day.calorieIntake.toLocaleString()} kcal in</>}
              {day.proteinG !== undefined && <> · {day.proteinG}g protein</>}
              {day.caffeineMg !== undefined && <> · {day.caffeineMg}mg caffeine{day.lateCaffeine ? " (late)" : ""}</>}
              {day.alcoholDrinks !== undefined && day.alcoholDrinks > 0 && (
                <> · {day.alcoholDrinks} drink{day.alcoholDrinks > 1 ? "s" : ""}</>
              )}
              {day.alcoholDrinks === 0 && <> · alcohol-free</>}
            </Row>
          )}

          {(day.stress !== undefined || day.mood !== undefined || day.screenTimeMin !== undefined) && (
            <Row icon={HeartPulse} label="Wellbeing">
              {day.stress !== undefined && <>Stress {fmt(day.stress, 1)}/10</>}
              {day.mood !== undefined && <> · Mood {fmt(day.mood, 1)}/10</>}
              {day.screenTimeMin !== undefined && <> · {day.screenTimeMin} min screen time</>}
              {day.travel && <> · ✈️ travel</>}
              {day.sauna && <> · sauna</>}
              {day.meditation && <> · meditated</>}
            </Row>
          )}

          {day.notes && (
            <Row icon={NotebookPen} label="Notes">
              <span className="italic text-base-200">&ldquo;{day.notes}&rdquo;</span>
            </Row>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function TimelineBody() {
  const { days, eventsByDate } = useHealthData();
  const params = useSearchParams();
  const requested = params.get("date");
  const [selected, setSelected] = useState<string>(requested ?? days[days.length - 1]?.date);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (requested && days.some((d) => d.date === requested)) setSelected(requested);
  }, [requested, days]);

  useEffect(() => {
    // Keep the selected dot in view.
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  const selectedDay = useMemo(() => days.find((d) => d.date === selected) ?? days[days.length - 1], [days, selected]);
  const idx = days.findIndex((d) => d.date === selectedDay.date);

  const months = useMemo(() => {
    const groups: { month: string; days: DayRecord[] }[] = [];
    for (const d of days) {
      const month = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const last = groups[groups.length - 1];
      if (last?.month === month) last.days.push(d);
      else groups.push({ month, days: [d] });
    }
    return groups;
  }, [days]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
      <p className="mt-1 text-sm text-base-400">
        Your calendar and your body, side by side — every day like a commit history. Color = recovery. Click any square.
      </p>

      <div ref={scrollerRef} className="mt-6 overflow-x-auto pb-3">
        <div className="flex gap-4">
          {months.map((g) => (
            <div key={g.month} className="shrink-0">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-base-400">{g.month}</div>
              <div className="flex gap-1">
                {g.days.map((d) => (
                  <div key={d.date} data-date={d.date}>
                    <DayDot day={d} selected={d.date === selectedDay.date} onClick={() => setSelected(d.date)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-[11px] text-base-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-status-good" /> 67–100%</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-status-warning" /> 34–66%</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-status-critical" /> 0–33%</span>
        <span className="ml-auto flex gap-2">
          <button
            disabled={idx <= 0}
            onClick={() => setSelected(days[idx - 1].date)}
            className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/[0.06] disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            disabled={idx >= days.length - 1}
            onClick={() => setSelected(days[idx + 1].date)}
            className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/[0.06] disabled:opacity-30"
          >
            Next →
          </button>
        </span>
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait">
          <DayDetail day={selectedDay} events={eventsByDate.get(selectedDay.date)?.all ?? []} />
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  return (
    <RequireData>
      <Suspense fallback={null}>
        <TimelineBody />
      </Suspense>
    </RequireData>
  );
}
