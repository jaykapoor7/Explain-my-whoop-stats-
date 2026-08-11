"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Card, PageHeader, SkeletonPage, StatusPill } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { addDays, cn, fmtDate, fmtTime, relativeDay, todayISO } from "@/lib/format";
import { TaskKind, TaskPriority } from "@/lib/types";

const KIND_COLOR: Record<TaskKind, string> = {
  task: "#9fb6ff", class: "#7dd3fc", exam: "#ff6b6b", assignment: "#f6b83b",
  work: "#c9b98a", event: "#e089d2", workout: "#ff7a5c",
};

function AddTask({ date, onClose }: { date: string; onClose: () => void }) {
  const addTask = useApp((s) => s.addTask);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("task");
  const [start, setStart] = useState("");
  const [estMin, setEstMin] = useState("60");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-100">New item · {relativeDay(date)}</span>
          <button onClick={onClose} className="text-ink-400" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-10 rounded-xl border border-white/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-white/25 sm:col-span-2" />
          <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} className="h-10 rounded-xl border border-white/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none">
            {(Object.keys(KIND_COLOR) as TaskKind[]).map((k) => (
              <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="h-10 rounded-xl border border-white/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none">
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none [color-scheme:dark]" />
          <input type="number" value={estMin} onChange={(e) => setEstMin(e.target.value)} placeholder="Est. minutes" className="tabular h-10 rounded-xl border border-white/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none" />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            disabled={!title.trim()}
            onClick={() => {
              addTask({ id: `ut-${Date.now()}`, date, title: title.trim(), kind, start: start || undefined, estMin: parseInt(estMin, 10) || undefined, priority, done: false });
              onClose();
            }}
            className="rounded-full bg-[#9fb6ff] px-4 py-2 text-xs font-semibold text-ink-950 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

export default function PlannerPage() {
  const data = useHealth();
  const { toggleTask, removeTask, tasks } = useApp();
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(todayISO());
  const [adding, setAdding] = useState(false);

  const daysInView = view === "day" ? 1 : view === "week" ? 7 : 30;
  const dates = useMemo(() => Array.from({ length: daysInView }, (_, i) => addDays(anchor, i)), [anchor, daysInView]);
  const addedIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);

  if (!data.hydrated) return <SkeletonPage />;

  const rec = data.today?.recovery.score;
  const suggestion =
    rec === undefined
      ? "Connect your Fitbit and the planner will suggest scheduling around your recovery."
      : rec >= 67
      ? "Recovery is high today — a good day for your hardest study block or training."
      : rec >= 34
        ? "Moderate recovery — normal workload is fine; keep the hardest block before evening."
        : "Low recovery — consider shorter study blocks and swapping intense training for a walk.";

  return (
    <div className="animate-fadeUp">
      <PageHeader
        title="Planner"
        sub="Tasks, classes, deadlines and training — soon scheduled around your body."
        right={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
              {(["day", "week", "month"] as const).map((v) => (
                <button key={v} onClick={() => { setView(v); setAnchor(todayISO()); }} className={cn("px-3 py-1.5 font-medium capitalize", view === v ? "bg-white/[0.1] text-ink-50" : "text-ink-400")}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 rounded-full bg-[#9fb6ff] px-3.5 py-2 text-xs font-semibold text-ink-950">
              <Plus size={14} /> Add
            </button>
          </div>
        }
      />

      <Card className="mt-5 flex items-start gap-3 border-recovery/20 p-4">
        <StatusPill text={rec === undefined ? "No data" : `Recovery ${rec}%`} color="#38d39f" />
        <p className="text-xs leading-relaxed text-ink-300">{suggestion}</p>
      </Card>

      <div className="mt-4">
        <AnimatePresence>{adding && <AddTask date={anchor} onClose={() => setAdding(false)} />}</AnimatePresence>
      </div>

      <div className="space-y-4">
        {dates.map((date) => {
          const tasks = data.tasks
            .filter((t) => t.date === date)
            .sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));
          if (!tasks.length && view === "month") return null;
          return (
            <div key={date}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className={cn("text-[13px] font-semibold", date === todayISO() ? "text-ink-50" : "text-ink-300")}>{relativeDay(date)}</span>
                <span className="text-[11px] text-ink-500">{fmtDate(date, { month: "short", day: "numeric" })}</span>
              </div>
              {tasks.length ? (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <Card key={t.id} className="flex items-center gap-3 p-3.5">
                      <button
                        onClick={() => toggleTask(t.id, !t.done)}
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                          t.done ? "border-transparent bg-good text-ink-950" : "border-white/20 hover:border-white/40"
                        )}
                        aria-label="Toggle done"
                      >
                        {t.done && <Check size={13} strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-sm", t.done ? "text-ink-500 line-through" : "text-ink-100")}>{t.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
                          <span className="rounded-full px-1.5 py-px font-medium" style={{ background: `${KIND_COLOR[t.kind]}1f`, color: KIND_COLOR[t.kind] }}>
                            {t.kind}
                          </span>
                          {t.start && <span className="tabular">{fmtTime(t.start)}</span>}
                          {t.estMin && <span>{t.estMin}m</span>}
                          {t.priority === "high" && <span className="text-bad">high priority</span>}
                        </div>
                      </div>
                      {addedIds.has(t.id) && (
                        <button onClick={() => removeTask(t.id)} className="text-ink-500 hover:text-bad" aria-label="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-xs text-ink-500">Nothing scheduled.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
