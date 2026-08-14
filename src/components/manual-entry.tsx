"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Watch } from "lucide-react";
import { Card } from "@/components/ui";
import { useApp } from "@/lib/data/store";
import { manualDay } from "@/lib/data/manual";
import { addDays, cn, fmtDate, relativeDay, todayISO } from "@/lib/format";

const FIELD = "h-11 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 text-sm text-ink-100 outline-none focus:border-black/25";
const LABEL = "text-[11px] font-medium uppercase tracking-wide text-ink-500";

/** Enter a day's numbers by hand — works with any wearable (Apple Watch,
 * Garmin, Oura, Whoop, Samsung…) or none at all. */
export function ManualEntry() {
  const saveManualDay = useApp((s) => s.saveManualDay);
  const manualDays = useApp((s) => s.manualDays);
  const today = todayISO();

  const [date, setDate] = useState(today);
  const [f, setF] = useState({ sleepH: "", bedtime: "", wake: "", rhr: "", hrv: "", steps: "", wType: "", wMin: "", wHr: "" });
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setSaved(false); };
  const num = (v: string) => { const n = parseFloat(v); return isFinite(n) ? n : undefined; };
  const existing = manualDays.some((d) => d.date === date);

  const save = () => {
    saveManualDay(manualDay({
      date,
      sleepH: num(f.sleepH),
      bedtime: f.bedtime || undefined,
      wake: f.wake || undefined,
      rhr: num(f.rhr),
      hrv: num(f.hrv),
      steps: num(f.steps),
      workout: num(f.wMin) ? { type: f.wType.trim() || "Workout", minutes: num(f.wMin)!, avgHr: num(f.wHr) } : undefined,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hasAny = f.sleepH || f.rhr || f.hrv || f.steps || f.wMin;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nutrition/10 text-nutrition"><Watch size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-50">Add data from any device</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Not on Fitbit? Read the numbers from your Apple Watch, Garmin, Oura, Whoop or Samsung app and enter them —
            CURA scores them exactly the same, so any wearable works and can compete in Friends.
          </p>

          {/* Date */}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setDate(addDays(date, -1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 hover:text-ink-100" aria-label="Previous day"><ChevronLeft size={16} /></button>
            <div className="relative flex items-center gap-2 rounded-full border border-black/[0.08] px-3.5 py-2">
              <CalendarDays size={14} className="text-ink-400" />
              <span className="text-[13px] font-medium text-ink-100">{relativeDay(date)}</span>
              <span className="text-[11px] text-ink-500">{fmtDate(date, { month: "short", day: "numeric" })}</span>
              <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick a date" />
            </div>
            <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 hover:text-ink-100 disabled:opacity-30" aria-label="Next day"><ChevronRight size={16} /></button>
            {existing && <span className="text-[11px] text-good">entry saved</span>}
          </div>

          {/* Sleep */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-1"><span className={LABEL}>Sleep (hours)</span><input value={f.sleepH} onChange={(e) => set("sleepH", e.target.value)} inputMode="decimal" placeholder="7.5" className={cn(FIELD, "tabular mt-1.5")} /></label>
            <label className="block"><span className={LABEL}>Bedtime</span><input type="time" value={f.bedtime} onChange={(e) => set("bedtime", e.target.value)} className={cn(FIELD, "mt-1.5 [color-scheme:light]")} /></label>
            <label className="block"><span className={LABEL}>Wake</span><input type="time" value={f.wake} onChange={(e) => set("wake", e.target.value)} className={cn(FIELD, "mt-1.5 [color-scheme:light]")} /></label>
          </div>

          {/* Vitals + activity */}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block"><span className={LABEL}>Resting HR (bpm)</span><input value={f.rhr} onChange={(e) => set("rhr", e.target.value)} inputMode="numeric" placeholder="55" className={cn(FIELD, "tabular mt-1.5")} /></label>
            <label className="block"><span className={LABEL}>HRV (ms)</span><input value={f.hrv} onChange={(e) => set("hrv", e.target.value)} inputMode="numeric" placeholder="60" className={cn(FIELD, "tabular mt-1.5")} /></label>
            <label className="block"><span className={LABEL}>Steps</span><input value={f.steps} onChange={(e) => set("steps", e.target.value)} inputMode="numeric" placeholder="9000" className={cn(FIELD, "tabular mt-1.5")} /></label>
          </div>

          {/* Optional workout */}
          <div className="mt-3">
            <span className={LABEL}>Workout (optional)</span>
            <div className="mt-1.5 grid gap-3 sm:grid-cols-3">
              <input value={f.wType} onChange={(e) => set("wType", e.target.value)} placeholder="Type (e.g. Run)" className={FIELD} />
              <input value={f.wMin} onChange={(e) => set("wMin", e.target.value)} inputMode="numeric" placeholder="Minutes" className={cn(FIELD, "tabular")} />
              <input value={f.wHr} onChange={(e) => set("wHr", e.target.value)} inputMode="numeric" placeholder="Avg HR" className={cn(FIELD, "tabular")} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            {saved && <span className="flex items-center gap-1 text-xs font-medium text-good"><Check size={13} /> Saved</span>}
            <button onClick={save} disabled={!hasAny} className="rounded-full bg-nutrition px-5 py-2.5 text-xs font-semibold text-[#241f18] disabled:opacity-40">Save day</button>
          </div>
        </div>
      </div>
    </Card>
  );
}
