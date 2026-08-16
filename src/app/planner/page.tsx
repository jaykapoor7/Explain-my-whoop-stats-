"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, HeartPulse, ListTodo, Plus, Send, Trash2, X } from "lucide-react";
import { Card, IconBadge, PageHeader, Section, SkeletonPage } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { addDays, cn, fmtDate, fmtTime, isoOf, relativeDay, todayISO } from "@/lib/format";
import { PlannerTask, TaskKind, TaskPriority } from "@/lib/types";

const KIND_COLOR: Record<TaskKind, string> = {
  task: "#5b6fd6", class: "#2298cf", exam: "#ef5a45", assignment: "#eb9d18",
  work: "#a98b3f", event: "#c2569f", workout: "#13b57e",
};
const KIND_LABEL: Record<TaskKind, string> = {
  task: "Task", class: "Class", exam: "Exam", assignment: "Assignment",
  work: "Work", event: "Event", workout: "Workout",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = { high: "#ef5a45", medium: "#eb9d18", low: "#a4977f" };
const ACCENT = "#5b6fd6";

/** Build a wa.me link. With a saved number it opens that chat; otherwise the WhatsApp share sheet. */
function waLink(text: string, number?: string) {
  const digits = (number ?? "").replace(/[^\d]/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

function planMessage(dateLabel: string, scheduled: PlannerTask[], todos: PlannerTask[]) {
  const lines = [`📋 Plan for ${dateLabel}`, ""];
  if (scheduled.length) {
    for (const t of scheduled) {
      const time = t.start ? `${fmtTime(t.start)} · ` : "";
      lines.push(`${t.done ? "✅" : "▫️"} ${time}${t.title}${t.estMin ? ` (${t.estMin}m)` : ""}`);
    }
  } else lines.push("— nothing scheduled —");
  const openTodos = todos.filter((t) => !t.done);
  if (openTodos.length) {
    lines.push("", "To-do:");
    for (const t of openTodos) lines.push(`▫️ ${t.title}`);
  }
  return lines.join("\n");
}

function MetaChip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
      style={color ? { background: `${color}1c`, color } : { background: "rgba(0,0,0,0.05)", color: "#83765f" }}
    >
      {children}
    </span>
  );
}

function AddTask({ date, onClose }: { date: string; onClose: () => void }) {
  const addTask = useApp((s) => s.addTask);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("task");
  const [when, setWhen] = useState(date);
  const [start, setStart] = useState("");
  const [estMin, setEstMin] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [asTodo, setAsTodo] = useState(false);

  const submit = () => {
    if (!title.trim()) return;
    addTask({
      id: `ut-${Date.now()}`,
      date: asTodo ? todayISO() : when,
      title: title.trim(),
      kind,
      start: asTodo ? undefined : start || undefined,
      estMin: parseInt(estMin, 10) || undefined,
      priority,
      done: false,
      todo: asTodo || undefined,
    });
    onClose();
  };

  const field = "field h-10 px-3 text-sm";

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" style={{ ["--accent" as string]: ACCENT }}>
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <IconBadge color={ACCENT} size={28}><Plus size={15} /></IconBadge>
            New {asTodo ? "to-do" : "item"}
          </span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-100" aria-label="Close"><X size={16} /></button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="What needs doing?"
          className={cn(field, "mt-3 w-full")}
        />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} className={field}>
            {(Object.keys(KIND_LABEL) as TaskKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={field}>
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          {!asTodo && (
            <>
              <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className={cn(field, "[color-scheme:light]")} />
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={cn(field, "[color-scheme:light]")} />
                <input type="number" inputMode="numeric" value={estMin} onChange={(e) => setEstMin(e.target.value)} placeholder="Est. min" className={cn(field, "tabular")} />
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-300">
            <input type="checkbox" checked={asTodo} onChange={(e) => setAsTodo(e.target.checked)} className="accent-[#5b6fd6]" />
            Add to to-do list (no date)
          </label>
          <button onClick={submit} disabled={!title.trim()} className="rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: ACCENT }}>
            Add
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

/** A checkbox that fills with the accent when done. */
function TaskCheck({ done, onToggle, color = "#13b57e" }: { done: boolean; onToggle: () => void; color?: string }) {
  return (
    <button
      onClick={onToggle}
      className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition", done ? "border-transparent text-[#241f18]" : "border-black/25 hover:border-black/45")}
      style={done ? { background: color } : undefined}
      aria-label="Toggle done"
    >
      {done && <Check size={13} strokeWidth={3} />}
    </button>
  );
}

/** One row on the day's agenda timeline. */
function TimelineItem({ t, last, whatsappNumber }: { t: PlannerTask; last: boolean; whatsappNumber?: string }) {
  const toggleTask = useApp((s) => s.toggleTask);
  const removeTask = useApp((s) => s.removeTask);
  const c = KIND_COLOR[t.kind];
  return (
    <div className="flex gap-3">
      <div className="tabular w-16 shrink-0 pt-3.5 text-right text-[11px] font-semibold text-ink-400">{t.start ? fmtTime(t.start) : "—"}</div>
      <div className="relative flex flex-col items-center pt-4">
        <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-[#faf6ee]" style={{ background: c }} />
        {!last && <span className="mt-1 w-px flex-1 bg-black/[0.09]" />}
      </div>
      <Card className="mb-2.5 flex flex-1 items-center gap-3 p-3.5">
        <TaskCheck done={t.done} onToggle={() => toggleTask(t.id, !t.done)} color={c} />
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-sm font-medium", t.done ? "text-ink-500 line-through" : "text-ink-100")}>{t.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <MetaChip color={c}>{KIND_LABEL[t.kind]}</MetaChip>
            {t.estMin ? <MetaChip>{t.estMin}m</MetaChip> : null}
            {t.priority === "high" && <MetaChip color="#ef5a45">high</MetaChip>}
          </div>
        </div>
        <button onClick={() => window.open(waLink(`▫️ ${t.start ? fmtTime(t.start) + " · " : ""}${t.title}`, whatsappNumber), "_blank")} className="text-ink-400 transition-colors hover:text-[#25D366]" aria-label="Send to WhatsApp" title="Send to WhatsApp">
          <Send size={14} />
        </button>
        <button onClick={() => removeTask(t.id)} className="text-ink-400 hover:text-bad" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      </Card>
    </div>
  );
}

/** A to-do row with a kind/priority accent bar. */
function TodoRow({ t }: { t: PlannerTask }) {
  const toggleTask = useApp((s) => s.toggleTask);
  const removeTask = useApp((s) => s.removeTask);
  const c = PRIORITY_COLOR[t.priority];
  return (
    <Card className="flex items-center gap-3 overflow-hidden p-0">
      <span className="h-full w-1 self-stretch" style={{ background: t.done ? "rgba(0,0,0,0.08)" : c }} />
      <div className="flex flex-1 items-center gap-3 py-3 pr-3.5">
        <TaskCheck done={t.done} onToggle={() => toggleTask(t.id, !t.done)} />
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-sm", t.done ? "text-ink-500 line-through" : "text-ink-100")}>{t.title}</div>
          {t.priority !== "medium" && !t.done && (
            <div className="mt-1"><MetaChip color={c}>{t.priority} priority</MetaChip></div>
          )}
        </div>
        <button onClick={() => removeTask(t.id)} className="text-ink-400 hover:text-bad" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}

export default function PlannerPage() {
  const data = useHealth();
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const addTask = useApp((s) => s.addTask);

  const [selected, setSelected] = useState(todayISO());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [adding, setAdding] = useState(false);
  const [quickTodo, setQuickTodo] = useState("");

  const scheduled = useMemo(
    () => data.tasks.filter((t) => !t.todo && t.date === selected).sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99")),
    [data.tasks, selected]
  );
  const todos = useMemo(
    () => data.tasks.filter((t) => t.todo).sort((a, b) => Number(a.done) - Number(b.done)),
    [data.tasks]
  );
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data.tasks) if (!t.todo) m.set(t.date, (m.get(t.date) ?? 0) + 1);
    return m;
  }, [data.tasks]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Browser reminders: schedule notifications for the remaining timed tasks TODAY while the app is open.
  useEffect(() => {
    if (!settings.browserReminders || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const now = new Date();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const t of data.tasks) {
      if (t.todo || t.done || t.date !== todayISO() || !t.start) continue;
      const [h, m] = t.start.split(":").map(Number);
      const at = new Date(); at.setHours(h, m, 0, 0);
      const ms = at.getTime() - now.getTime();
      if (ms > 0 && ms < 24 * 3600 * 1000) {
        timers.push(setTimeout(() => new Notification(`${t.title}`, { body: `${fmtTime(t.start!)} · ${KIND_LABEL[t.kind]}` }), ms));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [settings.browserReminders, data.tasks]);

  if (!data.hydrated) return <SkeletonPage />;

  const rec = data.today?.recovery.score;
  const suggestion =
    rec === undefined
      ? "Connect your Fitbit and the planner will suggest scheduling around your recovery."
      : rec >= 67
        ? "Recovery is high today — a great day for your hardest study block or training."
        : rec >= 34
          ? "Moderate recovery — a normal workload is fine; keep the hardest block before evening."
          : "Low recovery — shorter blocks today, and swap intense training for a walk.";
  const recColor = rec === undefined ? "#a4977f" : rec >= 67 ? "#13b57e" : rec >= 34 ? "#eb9d18" : "#ef5a45";

  const doneCount = scheduled.filter((t) => t.done).length;
  const openTodos = todos.filter((t) => !t.done).length;
  const dayLabel = fmtDate(selected, { weekday: "short", month: "short", day: "numeric" });
  const sendDay = () => window.open(waLink(planMessage(dayLabel, scheduled, todos), settings.whatsappNumber), "_blank");

  const toggleReminders = async () => {
    if (settings.browserReminders) return setSettings({ browserReminders: false });
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setSettings({ browserReminders: perm === "granted" });
    }
  };

  return (
    <div className="animate-fadeUp">
      <PageHeader
        back
        title="Planner"
        sub="Plan your days around your body — with a to-do list and WhatsApp reminders."
        right={
          <div className="flex items-center gap-2">
            <button onClick={toggleReminders} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition", settings.browserReminders ? "border-recovery/40 bg-recovery/10 text-recovery" : "border-black/[0.1] text-ink-400 hover:text-ink-100")} title="Browser reminders while the app is open">
              {settings.browserReminders ? <Bell size={13} /> : <BellOff size={13} />}
              <span className="hidden sm:inline">Reminders</span>
            </button>
            <button onClick={sendDay} className="flex items-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#1c9e4b]">
              <Send size={13} /> <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white" style={{ background: ACCENT }}>
              <Plus size={14} /> Add
            </button>
          </div>
        }
      />

      {/* Recovery-aware banner */}
      <Card className="tint mt-5 flex items-center gap-4 p-4" style={{ ["--accent" as string]: recColor }}>
        <IconBadge color={recColor} size={44}><HeartPulse size={20} /></IconBadge>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink-100">{rec === undefined ? "No recovery data" : `Recovery ${rec}%`}</span>
            <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: recColor }}>
              {rec === undefined ? "" : rec >= 67 ? "Primed" : rec >= 34 ? "Steady" : "Take it easy"}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{suggestion}</p>
        </div>
      </Card>

      {/* Week date strip */}
      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 transition hover:bg-black/[0.04] hover:text-ink-100" aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {weekDates.map((d) => {
            const isSel = d === selected;
            const isToday = d === todayISO();
            const n = countByDate.get(d) ?? 0;
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                className={cn("flex flex-col items-center rounded-xl border py-2 transition", isSel ? "border-transparent text-white shadow-lift" : "border-black/[0.06] text-ink-300 hover:bg-black/[0.03]")}
                style={isSel ? { background: ACCENT } : undefined}
              >
                <span className={cn("text-[10px] font-medium uppercase", isSel ? "text-white/80" : "text-ink-500")}>{fmtDate(d, { weekday: "short" })}</span>
                <span className="tabular mt-0.5 text-[15px] font-bold" style={isToday && !isSel ? { color: ACCENT } : undefined}>{fmtDate(d, { day: "numeric" })}</span>
                <span className={cn("mt-1 h-1 w-1 rounded-full", n ? (isSel ? "bg-white" : "") : "bg-transparent")} style={n && !isSel ? { background: ACCENT } : undefined} />
              </button>
            );
          })}
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-ink-400 transition hover:bg-black/[0.04] hover:text-ink-100" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-4">
        <AnimatePresence>{adding && <AddTask date={selected} onClose={() => setAdding(false)} />}</AnimatePresence>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5">
        {/* Schedule for selected day */}
        <Section
          className="mt-6"
          title={`Schedule · ${relativeDay(selected)}`}
          sub={fmtDate(selected, { weekday: "long", month: "long", day: "numeric" })}
          accent={ACCENT}
          action={scheduled.length ? <span className="tabular rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-semibold text-ink-400">{doneCount}/{scheduled.length} done</span> : undefined}
        >
          {scheduled.length ? (
            <div>
              {scheduled.map((t, i) => (
                <TimelineItem key={t.id} t={t} last={i === scheduled.length - 1} whatsappNumber={settings.whatsappNumber} />
              ))}
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full rounded-2xl border border-dashed border-black/[0.12] px-4 py-8 text-center text-xs text-ink-500 transition hover:border-black/25 hover:text-ink-300">
              Nothing planned for {relativeDay(selected).toLowerCase()} — tap to add something.
            </button>
          )}
        </Section>

        {/* To-do list */}
        <Section className="mt-6" title="To-do list" sub={openTodos ? `${openTodos} open` : "all clear"} accent="#13b57e" icon={<ListTodo size={15} />}>
          <Card className="mb-3 flex items-center gap-2 p-2.5" style={{ ["--accent" as string]: "#13b57e" }}>
            <ListTodo size={16} className="ml-1 shrink-0 text-ink-400" />
            <input
              value={quickTodo}
              onChange={(e) => setQuickTodo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickTodo.trim()) {
                  addTask({ id: `ut-${Date.now()}`, date: todayISO(), title: quickTodo.trim(), kind: "task", priority: "medium", done: false, todo: true });
                  setQuickTodo("");
                }
              }}
              placeholder="Add a quick to-do and press Enter…"
              className="h-8 flex-1 bg-transparent text-sm text-ink-100 outline-none placeholder:text-ink-500"
            />
          </Card>
          {todos.length ? (
            <div className="space-y-2">
              {todos.map((t) => <TodoRow key={t.id} t={t} />)}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-black/[0.1] px-4 py-6 text-center text-xs text-ink-500">Your to-do list is empty.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function startOfWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return isoOf(addDaysDate(d, -day));
}
function addDaysDate(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
