"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Pill, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { Card, EmptyState, PageHeader, ProgressBar, Section, SkeletonPage, StatusPill } from "@/components/ui";
import { useHealth, deriveMedEvents } from "@/lib/data/use-health";
import { useApp } from "@/lib/data/store";
import { addDays, cn, fmtDate, fmtTime, todayISO } from "@/lib/format";
import { MedFrequency, MedStatus, Medication } from "@/lib/types";

const ACCENT = "#e089d2";

const STATUS_META: Record<MedStatus, { label: string; color: string }> = {
  taken: { label: "Taken", color: "#38d39f" },
  delayed: { label: "Delayed", color: "#f6b83b" },
  skipped: { label: "Skipped", color: "#ff6b6b" },
  pending: { label: "Pending", color: "#6b7482" },
};

function AddMed({ onClose }: { onClose: () => void }) {
  const addMedication = useApp((s) => s.addMedication);
  const [f, setF] = useState({ name: "", dose: "", frequency: "once" as MedFrequency, time1: "08:00", time2: "20:00", time3: "14:00", withFood: "either" as Medication["withFood"], notes: "" });

  const times =
    f.frequency === "once" ? [f.time1] : f.frequency === "twice" ? [f.time1, f.time2] : f.frequency === "thrice" ? [f.time1, f.time3, f.time2] : [];

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-100">Add medication</span>
          <button onClick={onClose} className="text-ink-400" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-black/25" />
          <input value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="Dose (e.g. 10 mg)" className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none focus:border-black/25" />
          <select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as MedFrequency })} className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none">
            <option value="once">Once daily</option>
            <option value="twice">Twice daily</option>
            <option value="thrice">Three times daily</option>
            <option value="as-needed">As needed</option>
          </select>
          <select value={f.withFood} onChange={(e) => setF({ ...f, withFood: e.target.value as Medication["withFood"] })} className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none">
            <option value="either">With or without food</option>
            <option value="with">With food</option>
            <option value="without">Without food</option>
          </select>
          {f.frequency !== "as-needed" && (
            <input type="time" value={f.time1} onChange={(e) => setF({ ...f, time1: e.target.value })} className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none [color-scheme:dark]" />
          )}
          {(f.frequency === "twice" || f.frequency === "thrice") && (
            <input type="time" value={f.time2} onChange={(e) => setF({ ...f, time2: e.target.value })} className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none [color-scheme:dark]" />
          )}
          {f.frequency === "thrice" && (
            <input type="time" value={f.time3} onChange={(e) => setF({ ...f, time3: e.target.value })} className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none [color-scheme:dark]" />
          )}
          <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Notes (optional)" className="h-10 rounded-xl border border-black/10 bg-ink-875 px-3 text-sm text-ink-100 outline-none sm:col-span-2" />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            disabled={!f.name.trim()}
            onClick={() => {
              addMedication({
                id: `med-${Date.now()}`,
                name: f.name.trim(),
                dose: f.dose.trim() || "—",
                frequency: f.frequency,
                times,
                withFood: f.withFood,
                startDate: todayISO(),
                notes: f.notes.trim() || undefined,
              });
              onClose();
            }}
            className="rounded-full px-4 py-2 text-xs font-semibold text-[#241f18] disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            Add medication
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

export default function MedicationPage() {
  const data = useHealth();
  const { setMedStatus, removeMedication, medOverrides, medications } = useApp();
  const [adding, setAdding] = useState(false);

  const history = useMemo(() => {
    const out: { date: string; taken: number; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = addDays(todayISO(), -i);
      const evts = deriveMedEvents(medications, date, medOverrides).filter((e) => e.scheduled);
      out.push({ date, taken: evts.filter((e) => e.status === "taken").length, total: evts.length });
    }
    return out;
  }, [medications, medOverrides]);

  if (!data.hydrated) return <SkeletonPage />;

  const logged = history.reduce((s, h) => s + h.taken, 0);
  const denom = history.reduce((s, h) => s + h.total, 0);
  const adherence = denom ? Math.round((logged / denom) * 100) : 0;
  const medInsights = data.insights.filter((i) => i.domain === "medication");

  return (
    <div className="animate-fadeUp">
      <PageHeader
        title="Medication"
        sub="Schedule, adherence and history — treated as sensitive data."
        right={
          <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[#241f18]" style={{ background: ACCENT }}>
            <Plus size={14} /> Add
          </button>
        }
      />

      <div className="mt-5">
        <AnimatePresence>{adding && <AddMed onClose={() => setAdding(false)} />}</AnimatePresence>
      </div>

      {medications.length === 0 ? (
        <EmptyState
          icon={<Pill size={20} />}
          title="No medications yet"
          body="Add a medication to get a daily schedule, adherence tracking, and — over time — observational associations with your sleep, recovery and mood."
        />
      ) : (
        <>
          {denom > 0 && (
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="tabular text-3xl font-bold text-ink-50">{adherence}%</span>
                  <span className="ml-1.5 text-sm text-ink-400">14-day adherence</span>
                </div>
                <span className="text-xs text-ink-400">{logged} of {denom} scheduled doses taken</span>
              </div>
              <div className="mt-3">
                <ProgressBar value={adherence} max={100} color={ACCENT} />
              </div>
            </Card>
          )}

          <Section title="Today's schedule">
            <div className="space-y-3">
              {data.todayMedEvents.filter((e) => e.scheduled).map((e) => {
                const med = medications.find((m) => m.id === e.medicationId)!;
                const meta = STATUS_META[e.status];
                return (
                  <Card key={e.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${ACCENT}1a`, color: ACCENT }}>
                        <Pill size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink-100">
                          {med.name} <span className="ml-1 text-xs font-normal text-ink-400">{med.dose}</span>
                        </div>
                        <div className="text-[11px] text-ink-400">
                          {fmtTime(e.scheduled)} · {med.withFood === "with" ? "with food" : med.withFood === "without" ? "without food" : "with or without food"}
                          {e.takenAt && e.status !== "skipped" ? ` · logged ${fmtTime(e.takenAt)}` : ""}
                        </div>
                      </div>
                      <StatusPill text={meta.label} color={meta.color} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      {([["taken", Check, "Taken"], ["delayed", Clock, "Delayed"], ["skipped", X, "Skipped"]] as const).map(([status, Icon, label]) => (
                        <button
                          key={status}
                          onClick={() => setMedStatus(e.id, status, status === "skipped" ? undefined : new Date().toTimeString().slice(0, 5))}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                            e.status === status ? "border-transparent bg-black/[0.12] text-ink-50" : "border-black/12 text-ink-300 hover:bg-black/[0.06]"
                          )}
                        >
                          <Icon size={12} /> {label}
                        </button>
                      ))}
                    </div>
                  </Card>
                );
              })}
              {!data.todayMedEvents.some((e) => e.scheduled) && (
                <Card className="p-4 text-xs text-ink-400">Only as-needed medications configured — nothing scheduled today.</Card>
              )}
            </div>
          </Section>

          <Section title="Your medications">
            <div className="grid gap-3 sm:grid-cols-2">
              {medications.map((m) => (
                <Card key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-ink-100">{m.name}</div>
                      <div className="mt-1 text-xs text-ink-400">
                        {m.dose} · {m.frequency === "as-needed" ? "as needed" : m.times.map(fmtTime).join(", ")}
                      </div>
                      {m.notes && <div className="mt-1.5 text-xs text-ink-500">{m.notes}</div>}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m.name}?`)) removeMedication(m.id);
                      }}
                      className="text-ink-500 hover:text-bad"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          {denom > 0 && (
            <Section title="Last 14 days" sub="Dose history">
              <Card className="overflow-x-auto p-4">
                <div className="flex min-w-[420px] gap-1.5">
                  {history.map((h) => {
                    const frac = h.total ? h.taken / h.total : 0;
                    return (
                      <div key={h.date} className="flex flex-1 flex-col items-center gap-1.5">
                        <div
                          className="h-14 w-full rounded-md"
                          style={{ background: h.total === 0 ? "rgba(0,0,0,0.04)" : `${ACCENT}${frac === 1 ? "cc" : frac >= 0.5 ? "66" : "26"}` }}
                          title={`${h.taken}/${h.total} taken`}
                        />
                        <span className="text-[9px] text-ink-500">{fmtDate(h.date, { day: "numeric" })}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Section>
          )}
        </>
      )}

      {medInsights.length > 0 && (
        <Section title="Observed associations" sub="Observational only — never medical advice">
          <div className="space-y-3">
            {medInsights.map((i) => (
              <Card key={i.id} className="p-4">
                <p className="text-sm font-medium text-ink-100">{i.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-400">{i.detail}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Card className="mt-8 flex items-start gap-3 border-black/[0.08] p-4">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-ink-400" />
        <p className="text-xs leading-relaxed text-ink-400">
          This app never recommends starting, stopping, or changing any medication or dose. Medication data stays on
          your device. Discuss anything concerning with your doctor or pharmacist.
        </p>
      </Card>
    </div>
  );
}
